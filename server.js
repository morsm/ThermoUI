const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const http = require('http');
const bodyJson = require("body/json");
const Config = require("./config.json");

const app = express();
const port = 4000;

app.use(express.static('public'));
app.use(bodyParser.json( {
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }})
    );

// Mappings to locations
app.get('/', (req, res) => sendIndex(res));
app.post('/post_temp', (req, res) => handleTempChange(req,res));
app.post('/ajax_update', (req, res) => waitForUpdate(req,res));

app.listen(port, () => console.log(`Thermo UI app listening at http://localhost:${port}`));


async function sendIndex(res)
{
    var state = {
        "RoomTemperature":
        {
            "value": 0.0,
            "scale": "Celsius"
        },
        "TargetTemperature":
        {
            "value": 0.0,
            "scale": "Celsius"
        },
        "HeatingOn": false,
        "RelativeHumidity": 0.0
    };
    
    try
    {
        state = await getThermostatState();
    } catch (err)
    {
        console.log("Error getting thermostat state: " +err);
    }
    
    ejs.renderFile('index.ejs', {state: state }, (err, str) => res.send(str));
}

async function handleTempChange(req, res)
{
    var tempIn = req.body;

    var state = await hippoHttpPostRequest(Config.thermoDaemonHost + Config.tempUri, tempIn);

    res.json(state);
}

async function getThermostatState()
{
    return hippoHttpGetRequest(Config.thermoDaemonHost + Config.stateUri);
}

async function waitForUpdate(req, res)
{
    var stateIn = req.body;
    var stateNew = await getThermostatState();
    var clientAlive = true;     

    req.clientAlive = true;
    req.on("close", () => {
        req.clientAlive = false; // Client will time out after 1 minute and resend AJAX
    });

    await compareState(stateIn, req, res);    
}

async function compareState(stateIn, req, res)
{
    if (! req.clientAlive) return;

    var stateNew = await getThermostatState();
    if (stateCompareString(stateIn) != stateCompareString(stateNew))
    {
        res.json(stateNew);
    }
    else setTimeout(() => {
        
        compareState(stateIn, req, res);

    }, 1000);
}

function stateCompareString(state)
{
    return state.RoomTemperature.value.toFixed(1) +
        state.RoomTemperature.scale.substring(0,1) +
        state.TargetTemperature.value.toFixed(1) +
        state.TargetTemperature.scale.substring(0,1) +
        state.RelativeHumidity.toFixed(1) +
        state.HeatingOn;
}

async function hippoHttpGetRequest(url)
{
    return new Promise((resolve, reject) => {

        http.get(url, (res) => {

            if (200 == res.statusCode) 
            {
                bodyJson(res, function (err, body) {
                   if (err) reject(err);
                   else resolve(body);
                });
            }
            else reject(res.statusCode);
        });

    });
}

async function hippoHttpPostRequest(url, body)
{
    var bodyTxt = JSON.stringify(body);
    
    return new Promise( (resolve, reject) =>
    {
        var options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": bodyTxt.length
            }
        };
    
        var req = http.request(url, options, (res) => {

            if (200 == res.statusCode) 
            {
                bodyJson(res, function (err, body) {
                   if (err) reject(err);
                   else resolve(body);
                });
            }
            else
            {
                var errorMessage = "Http Error: " + res.statusCode + " " + res.statusMessage;
                console.log(errorMessage);
                reject(errorMessage);
            }
        });
        
        req.on('error', (error) => {
            console.log("On Error HTTP Request: " + error);
            reject(error)
        });
        
        req.write(bodyTxt);
        req.end();
    });
}

