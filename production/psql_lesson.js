require('dotenv').config();
const pgp = require('pg-promise')({});

const cn = {
    host: process.env.HOST_LESSON, // server name or IP address;
    port: 5432,
    database: process.env.DB_LESSON,
    user: process.env.USER_LESSON,
    password: process.env.PASS_LESSON
};

// alternative:
// var cn = 'postgres://username:password@host:port/database';

const db = pgp(cn); // database instance;

// select and return a single user name from id:
module.exports.query_psql_lesson = async function(query, vars) {
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
