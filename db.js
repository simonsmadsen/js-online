const db = require('js-web').migration.mysql
/*
  Fieldtypes:
  id (auto increment),
  string,
  int,
  datetime,
  bool,
  text
 */


db.table('programs', {
  id: 'id',
  key: 'text',
  domain: 'string',
  port: 'int',
  ssl: 'bool',
  refreshSSL: 'datetime',
  startet: 'datetime'
})
