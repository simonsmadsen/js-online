module.exports = {
  programENV: program => 'websites/'+program.domain+'/.env',
  programInstall: program => 'cd websites/'+program.domain+'/ && yarn install',
  programStart: program => 'cd websites/'+program.domain+'/ && pm2 start app.js --name "'+program.domain+'" ',
  migrate: program => 'cd websites/'+program.domain+'/ && node '+program.migration,
  programRestart: program => 'cd websites/'+program.domain+'/ && pm2 restart "'+program.domain+'" ',
  programPath: program => 'websites/'+program.domain+'/'
}
