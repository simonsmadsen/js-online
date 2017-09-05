const web = require('js-web')
const ss = require('socket.io-stream')
const path = require('path')
const fs = require('fs')
const filendir = require('filendir')
const db = web.storage.mysql

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

/**
 * Routes
*/
web.htmlRoute('/', 'html/index.html', {
  a: [1,2,3,4,5,6,7,8,9,10,11,12,13]
}, injections)

web.notFound('html/not-found.html')

const keys = [
  'asladklmadsl12312askl'
]

web.socket('done', data => {
  const key = data.key
  // npm install key program
  // fix .env
  // start with pm2
})

web.onSocketConnection( async (socket) => {
  ss(socket).on('file', (stream, data) => {
    if(keys.indexOf(data.key) === -1){
      socket.emit('err','wrong key')
      return
    }
    const filename = data.name
    const dir = path.dirname(filename)
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir)
    }
    filendir.writeFileSync('websites/test/'+filename, null)
    stream.pipe(fs.createWriteStream('websites/test/'+filename))
  })
})


web.start()
