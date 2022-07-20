const express = require('express');
const axios = require('axios')
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config()
const app = express()

const waToken = process.env.WATOKEN;
const verify_token = process.env.VERIFY_TOKEN;
let Bot_Response = '';

function initialize() {
    app.use(express.static('pages'));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    app.use(cors());

    app.get('/chatbot/validation',function(req,res) {
        handelValidation(req, res);
    });

    app.post('/chatbot/userInput', function(req, res) {
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

function handelGetUserInput(req, res) {
    Bot_Response = '';
    let body = req.body;
    if(body.object) {
        if(body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
            let from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
            let msg_body = req.body.entry[0].changes[0].value.messages[0].text.body;
            let data = {
                'message' : msg_body
            }
            axios({
                method: 'post',
                url : process.env.URL,
                headers: { 
                    'Content-Type': 'application/json'
                },
                data : data
            }).then((result) => {
                console.log(result.data.result)
                if(result.data.result) {
                    axios({
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
                    })
                }
            }).catch((err) => {
                console.log(err);
            })
        } 
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
}