const web = require('js-web')
const ss = require('socket.io-stream')
const path = require('path')
const fs = require('fs')
const filendir = require('filendir')
const db = web.storage.local
const mem = web.storage.ram
const programs = db.table('programs')
const settings = db.table('settings')
const getSettings = _ => settings.find({id: 1})
const commands = require('./program-utils.js')
const certbot = require('./certbot.js')

const makeKey = () => Math.random().toString(36).slice(2)
const util = require('util')

const exec = require('child_process').exec;
const run = call => {
  return new Promise( (resolve,reject) => {
    console.log(call)
    exec(call, (error, stdout, stderr) => {
      if(stderr){
        console.log(stderr)
      }
      if (error) {
        reject(error)
      }
      resolve(stdout)
    })
  })
}
const ensureDatabase = (database, dbPassword) =>
  run(`mysql -u root --password="${dbPassword}" -e "CREATE DATABASE IF NOT EXISTS ${database}"`)
/**
 * Injections
*/
const injections = [
  web.inject.googleAnalytics(),
  web.inject.jquery(),
  web.inject.bootstrap(),
  web.inject.style('style/syntax.css'),
  web.inject.style('style/style.sass'),
  web.inject.script('script/main.js')
]

const isProgramRunning = async (program) => {
  const line = isProgramRinningGetLine(await run('pm2 list'),program)
  return isProgramRunningTest(line)
}

const isProgrammingRunningLoaded = (lines, program) => {
  const line = isProgramRinningGetLine(lines,program)
  return isProgramRunningTest(line)
}

const programLog = program => {
  return run('pm2 log '+program.domain)
}

const isProgramRinningGetLine = (list,program) => {
  return list.match(new RegExp(' '+program.domain+'[ \│]+.*disabled'))
}
const isProgramRunningTest = (line) => {
  if(!line || line.length < 1){
    return false
  }
  return line[0].indexOf('online') > -1
}

/**
 * Routes
*/
web.htmlRoute('/', 'html/index.html', async (input) => {
  const allPrograms = programs.select()
  const allLines = await run('pm2 list')

  return {
    programs: allPrograms.map( program => {
      program.protocol = program.ssl ? 'https' : 'http'
      program.online = isProgrammingRunningLoaded(allLines,program) ? 'Running :)' : 'Dead :('
      return program
    })
  }
}, injections)

web.postRoute('/settings/update', async (input) => {

  if(settings.find({id: 1})){
      settings.update(Object.assign(
        input,{id: 1}
      ),{id: 1})
  }else{
      settings.create(Object.assign(
        input,{id: 1}
      ))
  }
  return web.back()
  settings.insert()
})

web.htmlRoute('/new', 'html/new.html', async (input) => {
  return {}
})

web.htmlRoute('/settings', 'html/settings.html', async (input) => {
  return settings.find({id:1}) ||
    {mysql_port: 3306, mysql_host: 'localhost', mysql_username: 'root'}
})

web.route('/delete/:id', async (input) => {
  const program = programs.find({domain:input.id})
  if(!program) return {no:'program'}

  programs.delete({domain:input.id})
  try {
    console.log(await run('rm -R websites/'+program.domain) )
    console.log(await run('certbot delete --cert-name '+program.domain))
  } catch (err) {
    console.log(err)
  }
  try {
    console.log(await run('pm2 delete '+program.domain))
  } catch (err) {
    console.log('cant delete pm2');
  }

  await certbot(run,programs.select())
  return {}
})

const removeLastSlash
  = str => str[str.length -1] === '/' ? str.substring(0,str.length -1) : str

const cleanDomain = domain =>
  removeLastSlash(domain
  .replace('https','')
  .replace('://','')
  .replace('http',''))

web.postRoute('/programs/insert', async (input) => {
  programs.create({
    domain: cleanDomain(input.domain),
    port: input.port,
    file: input.file,
    migration: input.migration,
    ensure_database: input.ensure_database,
    facebook_app_id: input.facebook_app_id,
    google_client_id: input.google_client_id,
    google_api_key: input.google_api_key,
    twitter_consumer_key: input.twitter_consumer_key,
    twitter_consumer_secret: input.twitter_consumer_secret,
    key: makeKey(),
    ssl: true
  })

  if (input.ensure_database.length > 0) {
    try {
      await ensureDatabase(input.ensure_database,getSettings().mysql_password)
    } catch (err) {
      console.log(err)
    }
  }
  await certbot(run,programs.select())
  return web.redirect('/')
})

web.notFound('html/not-found.html')

const keys = () => programs.select().map(p => p.key)

const programBykey = key =>
  programs.select().filter(p => p.key === key)[0]

  const replaceReg = key => new RegExp('\n'+key+'=.*')
  const fixENV = (corrections, file) =>
    Object.keys(corrections)
    .filter(key =>
      (corrections[key] || '').length > 0
    )
    .reduce( (file, correntionKey) =>
      file.replace(replaceReg(correntionKey),'\n'+correntionKey+'='+corrections[correntionKey])
    ,file)

const overrideENV = program => {
  if(fs.existsSync(commands.programENV(program))){
    let file = fs.readFileSync(commands.programENV(program),'utf-8')
    const systemSettings = getSettings()
    fs.writeFileSync(fixENV(
      {
        port: program.port,
        https_privkey: `/etc/letsencrypt/live/${program.domain}/privkey.pem`,
        https_cert: `/etc/letsencrypt/live/${program.domain}/cert.pem`,
        https_fullchain: `/etc/letsencrypt/live/${program.domain}/fullchain.pem`,
        https: 'true',
        mysql_host: systemSettings.mysql_host,
        mysql_username: systemSettings.mysql_username,
        mysql_password: systemSettings.mysql_password,
        mysql_port: systemSettings.mysql_port,
        facebook_app_id: program.facebook_app_id,
        google_client_id: program.google_client_id,
        google_api_key: program.google_api_key,
        twitter_consumer_key: program.twitter_consumer_key,
        twitter_consumer_secret: program.twitter_consumer_secret
      },commands.programENV(program)
    ))
  }
}

web.socket('done', async (data, socket) => {
  const program = programBykey(data.key)

  try {
    socket.emit('msg',commands.programInstall(program))
    await run(commands.programInstall(program))
    overrideENV(program)
    socket.emit('msg','override .env')
    if(program.migration.length > 0){
      socket.emit('msg','running '+program.migration)
      await run(commands.migrate(program))
    }

    socket.emit('msg',commands.programStart(program))
    try {
      await run(commands.programStart(program))
    } catch (err) {
      await run(commands.programRestart(program))
    }
    socket.emit('msg','done')
  } catch (err) {
    console.log(err)
    socket.emit('msg',err)
    socket.emit('msg','done')
  }
})

web.onSocketConnection( async (socket) => {
  ss(socket).on('file', (stream, data) => {
    if(keys().indexOf(data.key) === -1){
      socket.emit('err','wrong key')
      return
    }
    const program = programBykey(data.key)
    const filename = commands.programPath(program)+data.name
    console.log(filename + ' received');
    filendir.writeFileSync(filename, null)
    stream.pipe(fs.createWriteStream(filename))
  })
})

web.start()
