class TelegrafMongoSession {
    constructor(db, options) {
        this.options = Object.assign({
            sessionName: 'session',
            collectionName: 'sessions'
        }, options);
        this.db = db;
        this.collection = db.collection(this.options.collectionName);
    }

    async saveSession(key, session) {
        return await this.collection.updateOne({ key: key }, { $set: { data: session } }, { upsert: true });
    }

    async getSession(key) {
        const doc = await this.collection.findOne({ key: key });
        return doc ? doc.data : {};
    }

    async middleware(ctx, next) {
        const key = ctx.from && ctx.chat && `${ctx.chat.id}:${ctx.from.id}`;
        if (!key) {
            return next()
        }

        const session = await this.getSession(key);

        ctx[this.options.sessionName] = session;

        await next();
        await this.saveSession(key, ctx[this.options.sessionName] || { });
    }

    static setup(bot, mongo_url, params = {}) {
        let session;
        bot.use((...args) => session.middleware(...args));
        
        const { MongoClient } = require('mongodb');
        MongoClient.connect(mongo_url, { useNewUrlParser: true }).then((client) => {
            const db = client.db();
            session = new TelegrafMongoSession(db, params);
        }).catch((reason) => { 
            console.log('telegraf-session-mongodb: failed to connect to the database, session saving will not work.')
            console.log(reason);

            session = { middleware: function(ctx, next) { next(); } }
        });
    }
}

exports.middleware = (db, options = {}) => {
    const telegrafSession = new TelegrafMongoSession(db, options);
    return telegrafSession.middleware;
}
exports.TelegrafMongoSession = TelegrafMongoSession;
