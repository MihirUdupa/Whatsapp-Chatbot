const express = require('express');
const axios = require('axios')
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config()
const app = express()

const waToken = process.env.WATOKEN;
const verify_token = process.env.VERIFY_TOKEN;

function initialize() {
    app.use(express.static('pages'));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    app.use(cors());

    app.get('/chatbot/validation',function(req,res) {
        handelValidation(req, res);
    });

    app.post('/chatbot/validation', function(req, res) {
        handelGetUserInput(req, res);
    })
}

app.listen(3400,function(){
    console.log("Listening on port 3400");
    initialize();
});

function handelValidation(req, res) {
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
        if(body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
            from = req.body.entry[0].changes[0].value.messages[0].from;
            type = req.body.entry[0].changes[0].value.messages[0].type;
            if(type === "text") {
                msg_body_switcher = req.body.entry[0].changes[0].value.messages[0].text.body;
                msg_body = switcher(msg_body_switcher);
            } else if (type === "button") {
                msg_body = req.body.entry[0].changes[0].value.messages[0].button.text;
            }
            data.message = msg_body

            axios({
                method: 'post',
                url : process.env.URL,
                headers: {
                    'Content-Type': 'application/json'
                },
                data : data.message
            }).then(async (result) => {
                if(result.data.result) {
                    await axios({
                        method: 'post',
                        url : process.env.USER_URL + phone_number_id + "/messages?access_token=" + waToken,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data : {
                            messaging_product: "whatsapp",
                            to: from,
                            text: { body: result.data.result },
                        }
                    }).catch(err => {
                        console.log(err.response)
                    })
                    //#region displaying the options
                    if(msg_body === 'hi' || msg_body === 'Hi') {
                        axios({
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
                                    name: "bot_operations",
                                    language: {
                                        code: "en"
                                    }
                                }
                            }
                        }).catch(err => {
                            console.log(err)
                        })
                    }
                    //#endregion displaying the options
                }
            }).catch((err) => {
                console.log(err);
            })
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
    //#endregion ActualMessage
}

function switcher(messages) {
    switch(messages){
        case 1:
            return 'Jar Config';
            break;
        case 2:
            return 'Order Status';
            break;
        case 3:
            return 'Refund/Payment help';
            break;
        case 4:
            return 'Jar Status';
        case 5:
            return 'Track Order';
        case 6:
            return 'Delivery help';
        case 7:
            return 'Jar help';
        default:
            return messages;
            break;
    }
}