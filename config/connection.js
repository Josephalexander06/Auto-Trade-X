const MongoClient = require('mongodb').MongoClient;
const state = {
    db: null
};

module.exports.connect = function (callback) {
    const url = 'mongodb://127.0.0.1:27017/';
    const dbname = 'ShoppingCart';

    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
        if (err) {
            console.log("Error");
            if (callback) {
                callback(err);
            }
        } else {
            state.db = client.db(dbname);
            console.log("Database connected");
            if (callback) {
                callback();
            }
        }
    });
};

module.exports.get = function () {
    return state.db;
};
