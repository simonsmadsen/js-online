const certlist = 'certbot certificates'
const serverPath = '/etc/nginx/sites-enabled/'
const certlistMatch = (program,list) => list.match(new RegExp(' '+program.domain+'\n'))
const renew = 'certbot renew'
const nStop = 'service nginx stop'
const nStart = 'service nginx start'
const newCert = program => 'certbot certonly --standalone -d '+program.domain
const fs = require('fs')
const httpServer = program => `
server {
    listen 80;
    listen [::]:80;
    server_name ${program.domain};

    location / {
      proxy_pass http://localhost:${program.port};
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_buffering off;
    }
}
`
const httpsServer = program => `
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/${program.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${program.domain}/privkey.pem;
    server_name ${program.domain};

    location / {
      proxy_pass https://localhost:${program.port};
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_buffering off;
    }
}
`
const writeServers = data =>
  fs.writeFileSync(serverPath+'js-servers', data)

const makeServer = program =>
  program.ssl ? httpsServer(program) : httpServer(program)

const programToServer = (servers, program) =>
  servers + makeServer(program)

const sslOnly = program => program.ssl ? true : false

const ensureCert = run => async program => {
  const certs = await run(certlist)
  const line = certlistMatch(program,certs)
  const hasCert = !line || line.length < 1
  if(!hasCert){
    await run(newCert(program))
  }

  return Promise.resolve()
}

const programsToServer = programs =>
  programs.reduce(programToServer,'')

module.exports = async (run, programs) => {
  writeServers(programsToServer(programs))
  await run(nStop)

  await Promise.all(
    programs
    .filter(sslOnly)
    .map(ensureCert(run))
  )

  await run(nStart)
}
