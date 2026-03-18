const sql = require('mssql/msnodesqlv8');

class Database {
  static #pool = null;

  static #config = {
    connectionString:
      'Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Database=poulet;Trusted_Connection=yes;',
  };

  static async getPool() {
    if (!Database.#pool) {
      Database.#pool = await sql.connect(Database.#config);
    }
    return Database.#pool;
  }

  static get sql() {
    return sql;
  }
}

module.exports = Database;
