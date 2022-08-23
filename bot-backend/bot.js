const express = require('express');
const axios = require('axios')
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const app = express();
const mongoClient = require('mongodb').MongoClient;

const waToken = process.env.WATOKEN;
const verify_token = process.env.VERIFY_TOKEN;
const mongo_Uri = process.env.MONGO_URI;
const client = new mongoClient(mongo_Uri, {useNewUrlParser: true, useUnifiedTopology: true})
let collection

function initialize() {
    app.use(express.static('pages'));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    app.use(cors());
    client.connect(err => {
        if(err) {
            console.log(err);
            client.close();
        } else {
            collection = client.db("Wa_Test_Messages").collection("Whatsapp");

            app.get('/chatbot/validation',function(req,res) {
                handelValidation(req, res);
            });
        
            app.post('/chatbot/validation', function(req, res) {
                handelGetUserInput(req, res);
                res.sendStatus(200);
            })
        
            app.post('/chatbot/getMessage', function(req, res) {
                handelGetAllMessages(req.body, res);
            })

            app.get('/chatbot/getPhoneNumbers', function(req, res) {
                handelGetAllNumbers(req, res);
            })
        }
    })
}

app.listen(3400,function(){
    console.log("Listening on port 3400");
    initialize();
});

async function handelValidation(req, res) {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === "subscribe" && token === verify_token) {
        // Respond with 200 OK and challenge token from the request
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
        } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
        }
    }
}

async function handelGetUserInput(req, res) {
    let body = req.body;
    
    //#region test on localhost
    // console.log(body)
    // let data = {
    //     'message' : body.message
    // }

    // let helpMessage = {
    //     'message' : "/help"
    // }
    // if(body.message === 'hi' || body.message === 'Hi') {
    //     sendToBot(data);
    //     await sleep(2000)
    //     sendToBot(helpMessage)
    // }
    //#endregion test on localhost

    //#region ActualMessage
    if(body.object) {
        let phone_number_id = ''
        let from = ''
        let msg_body_switcher = ''
        let msg_body = ''
        let type = ''
        let data = {}
        const pattern = /Order_Id:/;
        if(body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
            type = req.body.entry[0].changes[0].value.messages[0].type;
            from = req.body.entry[0].changes[0].value.messages[0].from;
            if(type === "text") {
                let Usermessage = req.body.entry[0].changes[0].value.messages[0].text.body;
                let Botmessage = "";
                msg_body_switcher = req.body.entry[0].changes[0].value.messages[0].text.body;
                let time = getCurrentTimestamp();
                sendToDB(from, Usermessage, Botmessage,time);
                msg_body = switcher(msg_body_switcher);
            } else if (type === "button") {
                msg_body = req.body.entry[0].changes[0].value.messages[0].button.text;
            }

            if(msg_body.test(pattern)) {
                raiseTicket(msg_body, phone_number_id, from)
                return
            } else {
                data.message = msg_body
                await axios({
                    method: 'post',
                    url : process.env.URL,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data : data.message
                }).then(async (result) => {
                    if(result.data.result) {
                        let Botmessage = result.data.result;
                        let Usermessage = "";
                        let time = getCurrentTimestamp();
                        sendToDB(from, Usermessage, Botmessage, time);
                        await sendToWhatsApp(result.data.result, phone_number_id, from)
                        //#region displaying the options
                        if(msg_body === 'hi' || msg_body === 'Hi') {
                            await sendTemplate(phone_number_id, from)
                        }
                        //#endregion displaying the options
                    }
                }).catch((err) => {
                    console.log(err);
                })
            }
        }
        return
    } else {
        res.sendStatus(404);
    }
    //#endregion ActualMessage
}

function switcher(messages) {
    switch(messages){
        case '1':
            return 'Refund Queries';
            break;
        case '2':
            return 'Order Queries';
            break;
        case '3':
            return 'Product Queries';
            break;
        case '4':
            return 'Delivery Queries';
            break;
        case '5':
            return 'Delivery Issues';
            break;
        case '6':
            return 'Discount';
            break;
        case '7':
            return 'App Feedback';
            break;
        default:
            return messages;
            break;
    }
}

function sendToDB (from, Usermessage, Botmessage, time) {
    let inputData = {
        "Phone_Number" : from,
        "User_Messages": Usermessage,
        "Bot_Messages": Botmessage,
        "DateTime": time
    }
    collection.insertOne(inputData).then((result) => {
        console.log(result);
    }).catch((err) => {
        console.log(err);
    })
}

function getCurrentTimestamp() {
    return new Date().getTime();
}

function handelGetAllMessages(number, res) {
    let query = {
        "Phone_Number" : number.phone,
    }
    collection.find(query, {projection:{_id:0}}).sort({_id:-1}).toArray().then((result) => {
        if(result.length > 0) {
            res.json({"response_desc":"Success","response_data":result,"response_code":"0"})
        } else {
            res.json({"response_desc":"Failure","response_data":{},"response_code":"1"})
        }
    }).catch((err) => {
        res.json({"response_desc":"Internal Server Error","response_data":err,"response_code":"500"})
    })
}

function handelGetAllNumbers(req, res) {
    collection.distinct("Phone_Number").then((result) => {
        if(result.length > 0) {
            res.json({"response_desc":"Success","response_data":result,"response_code":"0"})
        } else {
            res.json({"response_desc":"Failure","response_data":{},"response_code":"1"})
        }
    }).catch((err) => {
        res.json({"response_desc":"Internal Server Error","response_data":err,"response_code":"500"})
    })
}

function raiseTicket(id, phone_number_id, from) {
    let ID = id.split(':')[1]
    let tktMessage = "Ticket for the Order : "+ID+" has been raised\nThe company will contact you within 24 hours\nThank you";
    sendToWhatsApp(tktMessage, phone_number_id, from);
    let time = getCurrentTimestamp();
    sendToDB(from, Usermessage, tktMessage, time);
}

async function sendToWhatsApp(data, phone_number_id, from) {
    await axios({
        method: 'post',
        url : process.env.USER_URL + phone_number_id + "/messages?access_token=" + waToken,
        headers: {
            'Content-Type': 'application/json'
        },
        data : {
            messaging_product: "whatsapp",
            to: from,
            text: { body: data },
        }
    }).catch(err => {
        console.log(err.response)
    })
}

async function sendTemplate(phone_number_id, from) {
    await axios({
        method: 'post',
        url : process.env.USER_URL + phone_number_id + "/messages",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer '+waToken
        },
        data: {
            messaging_product: "whatsapp",
            to: from,
            type: "template",
            template: {
                name: "bot_menu",
                language: {
                    code: "en"
                }
            }
        }
    }).catch(err => {
        console.log(err)
    })
}