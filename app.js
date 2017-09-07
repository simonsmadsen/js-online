const web = require('js-web')
const ss = require('socket.io-stream')
const path = require('path')
const fs = require('fs')
const filendir = require('filendir')
const db = web.storage.local
const programs = db.table('programs')
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
  return list.match(new RegExp(program.domain+'[ \│]+.*disabled'))
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


web.postRoute('/programs/insert', async (input) => {
  programs.create({
    port: input.port,
    domain: input.domain,
    key: makeKey(),
    ssl: true
  })
  await certbot(run,programs.select())
  return web.back()
})

web.notFound('html/not-found.html')

const keys = () => programs.select().map(p => p.key)

const programBykey = key =>
  programs.select().filter(p => p.key === key)[0]

const overrideENV = program => {
  if(fs.existsSync(commands.programENV(program))){
    let file = fs.readFileSync(commands.programENV(program),'utf-8')
    fs.writeFileSync(
      commands.programENV(program),
      file.replace(/\nport=.*/,'\nport='+program.port)
      .replace(/\nhttps_privkey=.*/,'\nhttps_privkey=/etc/letsencrypt/live/'+program.domain+'/privkey.pem')
      .replace(/\nhttps_cert=.*/,'\nhttps_cert=/etc/letsencrypt/live/'+program.domain+'/privkey.pem')
      .replace(/\nhttps_fullchain=.*/,'\nhttps_fullchain=/etc/letsencrypt/live/'+program.domain+'/privkey.pem')
      .replace(/\nhttps=.*/,'\nhttps=true')
    )
  }
}

web.socket('done', async (data) => {
  const program = programBykey(data.key)

  try {
    await run(commands.programInstall(program))
    overrideENV(program)

    try {
      await run(commands.programStart(program))
    } catch (err) {
      await run(commands.programRestart(program))
    }

  } catch (err) {
    console.log(err)
  }
})

web.onSocketConnection( async (socket) => {
  ss(socket).on('', (stream, data) => {
    if(keys().indexOf(data.key) === -1){
      socket.emit('err','wrong key')
      return
    }
    const program = programBykey(data.key)
    const filename = commands.programPath(program)+data.name

    filendir.writeFileSync(filename, null)
    stream.pipe(fs.createWriteStream(filename))
  })
})


web.start()
