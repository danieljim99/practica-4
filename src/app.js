import {MongoClient, ObjectID} from 'mongodb';
import {GraphQLServer} from "graphql-yoga";
import dateTime from "date-time";
import uuid from "uuid";
import "babel-polyfill";

const url = "mongodb+srv://username:password99@thecluster-mzag5.gcp.mongodb.net/test";

const dbConnect = async function(url) {
    const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});
    await client.connect();
    return client;
};

const runGraphQLServer = function(context) {
    const typeDefs = `
        type Query {
            getBills(username: String!, token: ID!): [Bill!]!
        }

        type Mutation {
            addUser(username: String!, password: String!): User!
            addBill(username: String!, token: String!, concept: String!, amount: Float!): Bill!
            login(username: String!, password: String!): User!
            logout(username: String!, token: String!): User!
            removeUser(username: String!, token: String!): User!
        }

        type User {
            username: String!
            password: String!
            bills: [Bill!]
            token: ID!
        }

        type Bill {
            date: String!
            concept: String!
            amount: Float!
            titular: User!
        }
    `
    const resolvers = {
        Bill: {
            titular: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const collection = db.collection("users");

                return await collection.findOne({username: parent.titular});
            },
        },

        User: {
            bills: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const collection = db.collection("bills");

                return await collection.find({titular: parent.username}).toArray();
            },
        },

        Query: {
            getBills: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const usersCollection = db.collection("users");
                const billsCollection = db.collection("bills");

                if(!(await usersCollection.findOne({username: args.username, token: args.token}))){
                    throw new Error(`user does not exist or token error`);
                }

                return await billsCollection.find({titular: args.username}).toArray();
            }
        },

        Mutation: {
            addUser: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const collection = db.collection("users");

                if(await collection.findOne({username: args.username})) {
                    throw new Error(`The username ${args.username} is already in use`);
                }

                const user = {
                    username: args.username,
                    password: args.password,
                    token: null,
                };

                const result = await collection.insertOne(user);

                return user;
            },

            addBill: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const usersCollection = db.collection("users");
                const billsCollection = db.collection("bills");

                if(!(await usersCollection.findOne({username: args.username, token: args.token}))){
                    throw new Error(`user does not exist or token error`);
                }

                const bill = {
                    date: dateTime(),
                    concept: args.concept,
                    amount: args.amount,
                    titular: args.username,
                };

                const result = await billsCollection.insertOne(bill);

                return bill;
            },

            login: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const collection = db.collection("users");

                if(!(await collection.findOne({username: args.username, password: args.password, token: null}))){
                    throw new Error(`incorrect username/password or user already logged`);
                }

                await collection.updateOne({username: args.username}, {$set: {token: uuid.v4()}});

                return await collection.findOne({username: args.username, password: args.password});
            },

            logout: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const collection = db.collection("users");

                if(!(await collection.findOne({username: args.username, token: args.token}))){
                    throw new Error(`User does not exist or token error`);
                }

                await collection.updateOne({username: args.username}, {$set: {token: null}});

                return await collection.findOne({username: args.username});
            },

            removeUser: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("practica4");
                const usersCollection = db.collection("users");
                const billsCollection = db.collection("bills");

                if(!(await usersCollection.findOne({username: args.username, token: args.token}))){
                    throw new Error(`User does not exist or token error`);
                }

                await billsCollection.deleteMany({titular: args.username});

                return (await usersCollection.findOneAndDelete({username: args.username, token: args.token})).value;
            },
        },
    };

    const server = new GraphQLServer({typeDefs, resolvers, context});
    server.start(() => console.log("Server started"));
};

const runApp = async function() {
    const client = await dbConnect(url);
    try {
        runGraphQLServer({client});
    } catch(e) {
        console.log(e);
        client.close();
    }
};

runApp();