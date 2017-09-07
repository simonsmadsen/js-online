module.exports = {
  programENV: program => 'websites/'+program.domain+'/.env',
  programInstall: program => 'cd websites/'+program.domain+'/ && npm install',
  programStart: program => 'cd websites/'+program.domain+'/ && pm2 start app.js --name "'+program.domain+'" ',
  programRestart: program => 'cd websites/'+program.domain+'/ && pm2 restart "'+program.domain+'" ',
  programPath: program => 'websites/'+program.domain+'/'
}
