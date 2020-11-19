const pgp = require('pg-promise')({});

const cn = {
    host: process.env.HOST, // server name or IP address;
    port: 5432,
    database: process.env.DB,
    user: process.env.USER,
    password: process.env.PASS
};

// alternative:
// var cn = 'postgres://username:password@host:port/database';

const db = pgp(cn); // database instance;

// select and return a single user name from id:
module.exports.query_psql = async function(query, vars) {
    return db.query(query, vars)
    .then(data => {
        // console.log(data); // print user name;
        return data;
    })
    .catch(error => {
        console.log(error); // print the error;
        return null
    });
}

// alternative - new ES7 syntax with 'await':
// await db.one('SELECT name FROM users WHERE id = $1', [123]);