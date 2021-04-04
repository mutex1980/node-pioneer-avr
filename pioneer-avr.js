/**
 * To control a Pioneer receiver via IP protocol.
 * Tested with VSX-2021
 */

var util = require('util'),
    net = require('net'),
    events = require('events');


var TRACE = true;
var DETAIL = true; // detail logging flag
var debug_log;

/**
 * Important include host and port.
 * e.g.:
 * var options = {
 *      port: 23,
 *      host: "192.168.0.9",
 *      log: true
 *  };
 */
var VSX = function(options) {
    events.EventEmitter.call(this); // inherit from EventEmitter

    this.client = this.connect(options);

    this.inputNames = {};

    TRACE = options.log;

    if (options.hasOwnProperty("debug_log")) {
        debug_log = options.debug_log;
        debug_log("configured custom debug logger");
    } else {
        debug_log = console.log
    }
};

util.inherits(VSX, events.EventEmitter);

VSX.prototype.connect = function(options) {
    var self = this;
    var client = net.connect(options);

    client.on("connect", function(socket) {
        handleConnection(self, socket);
    });

    client.on("data", function(data) {
        handleData(self, data);
    });

    client.on("end", function() {
        handleEnd(self);
    });

    client.on("error", function(err) {
        handleError(self, err);
    });

    return client;
};

VSX.prototype.query = function() {
    var self = this;

    self.client.write("?P\r"); // query power state
    self.client.write("?V\r"); // query volume state
    self.client.write("?ZV\r"); // query volume state
    self.client.write("?AP\r"); // query power state
    self.client.write("?M\r"); // query mute state
    self.client.write("?Z2M\r"); // query mute state
    self.client.write("?F\r"); // query selected input
    self.client.write("?L\r"); // query display listening mode

    // get input names
    var timeout = 100;
    for (var i in Inputs) {
        var inputId = Inputs[i];
        var getInputName = function(inputId, timeout) {
            setTimeout(function() {
                self.client.write("?RGB" + inputId + "\r");
            }, timeout);
        }
        getInputName(inputId, timeout);
        timeout += 100;
    }
}

/**
 * Turn unit power on or off
 */
VSX.prototype.power = function(on) {
    if (TRACE) {
        console.log("turning power: " + on);
    }
    if (on) {
        this.client.write("PO\r");
    } else {
        this.client.write("PF\r");
    }
};

/**
 * Turn unit power zone2 on or off
 */
VSX.prototype.zpower = function(on) {
    if (TRACE) {
        console.log("turning power: " + on);
    }
    if (on) {
        this.client.write("APO\r");
    } else {
        this.client.write("APF\r");
    }
};
/**
 * Turn mute on or off
 */
VSX.prototype.mute = function(on) {
    if (TRACE) {
        console.log("turning mute: " + on);
    }
    if (on) {
        this.client.write("MO\r");
    } else {
        this.client.write("MF\r");
    }
};
/**
 * Turn mute on or off zone2
 */
VSX.prototype.zmute = function(on) {
    if (TRACE) {
        console.log("turning mute: " + on);
    }
    if (on) {
        this.client.write("Z2MO\r");
    } else {
        this.client.write("Z2MF\r");
    }
};

/**
 * 
 * @param {Object} db from -80 to +12
 */
VSX.prototype.volume = function(db) {
    // [0 .. 185] 1 = -80dB , 161 = 0dB, 185 = +12dB
    if (TRACE) {
        console.log("setting volume db: " + db);
    }
    var val = 0;
    if (typeof db === "undefined" || db === null) {
        val = 0;
    } else if (db < -80) {
        val = 0;
    } else if (db > 12) {
        val = 185;
    } else {
        val = Math.round((db * 2) + 161);
    }
    var level = val.toString();
    while (level.length < 3) {
        level = "0" + level;
    }
    if (TRACE) {
        console.log("setting volume level: " + level);
    }
    this.client.write(level + "VL\r");
};

VSX.prototype.zvolume = function(db) {
    // [0 .. 81] 1 = -80dB , 81 = 0dB, 00 = ---dB
    if (TRACE) {
        console.log("setting zvolume db: " + db);
    }
    var val = 0;
    if (typeof db === "undefined" || db === null) {
        val = 0;
    } else if (db < -80) {
        val = 0; 
    } else if (db > 0) {
        val = 81; 
    } else {
        val = Math.round(db  + 81 )   ;
    }
    var level = val.toString();
    while (level.length < 2) {
        level = "0" + level;
    }
    if (TRACE) {
        console.log("setting zvolume level: " + level);
    }
    this.client.write(level + "ZV\r");
};

VSX.prototype.volumeUp = function() {
    this.client.write("VU\r");
};

VSX.prototype.volumeDown = function() {
    this.client.write("VD\r");
};

VSX.prototype.zvolumeUp = function() {
    this.client.write("ZU\r");
};

VSX.prototype.zvolumeDown = function() {
    this.client.write("ZD\r");
};
/**
 * Set the input
 */
VSX.prototype.selectInput = function(input) {
    let cmd = input.toString().padStart(2,"0") + "FN\r";
    debug_log("(pioneer-avr::VSX.prototype.selectInput) set input mode to: " + input + ", type: " + typeof(input) + ", cmd: " + cmd);
    this.client.write(cmd);
    this.client.write("?F\r");
};

VSX.prototype.selectZInput = function(input) {
    this.client.write(input + "ZS\r");
};
/**
 * Query the input name
 */
VSX.prototype.queryInputName = function(inputId) {
    this.client.write("?RGB" + inputId + "\r");
}

/**
 * Set the listening mode
 */
VSX.prototype.listeningMode = function(mode) {
    debug_log("(pioneer-avr::VSX.prototype.listeningMode) set listening mode to: " + mode);
    this.client.write(mode.toString().padStart(4,"0")+"SR\r");
};

/**
 * Press the enter button in HMG
 */
VSX.prototype.buttonHMGEnter = function() {
    this.client.write("30NW\r");
};

/**
 * Press the return button in HMG
 */
VSX.prototype.buttonHMGReturn = function() {
    this.client.write("31NW\r");
};

/**
 * Press the play button in HMG
 */
VSX.prototype.buttonHMGPlay = function() {
    this.client.write("10NW\r");
};

/**
 * Press the stop button in HMG
 */
VSX.prototype.buttonHMGStop = function() {
    this.client.write("20NW\r");
};

/**
 * Press the Up button in HMG
 */
VSX.prototype.buttonHMGUp = function() {
    this.client.write("26NW\r");
};

/**
 * Press the Down button in HMG
 */
VSX.prototype.buttonHMGDown = function() {
    this.client.write("27NW\r");
};

/**
 * Press the '1' button in HMG
 */
VSX.prototype.buttonHMG1 = function() {
    this.client.write("01NW\r");
};


function handleConnection(self, socket) {
    if (TRACE) {
        console.log("got connection.");
    }

    self.client.write("\r"); // wake
    setTimeout(function() {
        self.query();
        self.emit("connect");
    }, 100);

    self.socket = socket;
}

function handleData(self, d) {
    var input;
    var data = d.toString(); // make sure it's a string
    var length = data.lastIndexOf('\r');
    data = data.substr(0, length);

    // TODO implement a message to handler mapping instead of this big if-then statement

    if (data.startsWith("PWR")) { // power status
        var pwr = (data == "PWR0"); // PWR0 = on, PWR1 = off
        if (TRACE) {
            console.log("got power: " + pwr);
        }
        self.emit("power", pwr);
    } 
        else if (data.startsWith("APR")) { // power status Zone2
        var pwr = (data == "APR0"); // APR0 = on, APR1 = off
        if (TRACE) {
            console.log("got zpower: " + pwr);
        }
        self.emit("zpower", pwr);
    } 
	else if (data.startsWith("ZV")) { // volume status zone2
        var vol = data.substr(2, 3);

        // translate to dB.
        var db = (parseInt(vol) - 81) ;

        if (TRACE) {
            console.log("got zvolume: " + db + "dB (" + vol + ")");
        }

        self.emit("zvolume", db);
    } 
	else if (data.startsWith("VOL")) { // volume status
        var vol = data.substr(3, 3);

        // translate to dB.
        var db = (parseInt(vol) - 161) / 2;

        if (TRACE) {
            console.log("got volume: " + db + "dB (" + vol + ")");
        }

        self.emit("volume", db);
    } 
	else if (data.startsWith("MUT")) { // mute status
        var mute = data.endsWith("0"); // MUT0 = muted, MUT1 = not muted
        if (TRACE) {
            console.log("got mute: " + mute);
        }
        self.emit("mute", mute);
    } 
	else if (data.startsWith("Z2MUT")) { // mute status
        var mute = data.endsWith("0"); // MUT0 = muted, MUT1 = not muted
        if (TRACE) {
            console.log("got zmute: " + mute);
        }
        self.emit("zmute", mute);
    } 
	else if (data.startsWith("FN")) {
	    debug_log("(pioneer-avr::handleData) received input mode: " + data);
        input = data.substr(2, 2);
        if (TRACE) {
            console.log("got input: " + input + " : " + self.inputNames[input]);
        }
        self.emit("input", parseInt(input, 10), self.inputNames[input]);
    } 
	else if (data.startsWith("Z2F")) {
        input = data.substr(3, 2);
        if (TRACE) {
            console.log("got input: " + input + " : " + self.inputNames[input]);
        }
        self.emit("zinput", input, self.inputNames[input]);
    } 
	else if (data.startsWith("SSA")) {
        if (TRACE && DETAIL) {
            console.log("got SSA: " + data);
        }
    } else if (data.startsWith("APR")) {
        if (TRACE && DETAIL) {
            console.log("got APR: " + data);
        }
    } else if (data.startsWith("BPR")) {
        if (TRACE && DETAIL) {
            console.log("got BPR: " + data);
        }
    }
    else if (data.startsWith("SR")) { // listening mode     // DO NOT REACT ON SR - IT REFLECTS THE REMOTE KEY PRESSED TO CYCLIC SHIFT THROUGH MODES
        debug_log("(pioneer-avr::handleData) received set listening mode: " + data);
        var mode = parseInt(data.substring(2), 10);
    //    debug_log("received SR (LISTENING MODE SET): " + data + " (" + (mode in ListeningModes ? ListeningModes[mode] : "???") + ")");
        //if (TRACE && DETAIL) {
        //    console.error("got listening mode: " + mode);
        //}
        debug_log("(pioneer-avr::handleData) requesting display listening mode.");
        self.client.write("?L\r"); // query display listening mode
        self.emit("listening_mode_set", mode);
    }
    else if (data.startsWith("LM")) { // listening mode display
        debug_log("(pioneer-avr::handleData) received display listening mode: " + data);
        var mode_hex = parseInt(data.substring(2), 16);
        var mode_int = 999; // set to unknown
        var mode_str = null;
        for (var ms in ListeningModes) if (ListeningModes[ms][1].includes(mode_hex)) {
            mode_int = ListeningModes[ms][0];
            mode_str = ms;
            break;
        }
        if (mode_str != null) debug_log("(pioneer-avr::handleData) decoded hex listening mode: 0x" + mode_hex.toString(16) + " into " + mode_int + " (" + mode_str + ")");
        else debug_log("(pioneer-avr::handleData) unable to decode hex listening mode: 0x" + mode_hex.toString(16));
        self.emit("listening_mode_display", mode_int);
    }
    else if (data.startsWith("FL")) { // FL display information
        if (TRACE && DETAIL) {
            console.log("got FL: " + data);
        }
    } else if (data.startsWith("RGB")) { // input name information. informs on input names
        // handle input info
        var inputId = data.substr(3, 2);
        for (input in Inputs) {
            if (Inputs[input] == inputId) {
                // if (data.substr(5, 1) == "0") {
                // console.log("default input name")
                // }
                self.inputNames[inputId] = data.substr(6);
                if (TRACE && DETAIL) {
                    console.log("set input " + input + " to " + self.inputNames[inputId]);
                }
                self.emit("inputName", inputId, self.inputNames[inputId]);
                break;
            }
        }
    } else if (data.startsWith("RGC")) {
        if (TRACE && DETAIL) {
            console.log("got RGC: " + data);
        }
    } else if (data.startsWith("RGF")) {
        if (TRACE && DETAIL) {
            console.log("got RGF: " + data);
        }
    } else if (data.length > 0) {
        if (TRACE) {
            console.log("got data: " + data);
        }
    }
}

function handleEnd(self) {
    if (TRACE) {
        console.log("connection ended");
    }

    self.emit("end");
}

function handleError(self, err) {
    if (TRACE) {
        console.log("connection error: " + err.message);
    }

    self.emit("error", err);
}

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function(str) {
        return this.slice(0, str.length) == str;
    };
}

if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function(str) {
        return this.slice(-str.length) == str;
    };
}
/*
var Inputs = {
    SC-LX76 : {
        "IN1/DVD" : 4,

    }
}*/

var Inputs = {
    dvd: 4,
    bd: 25,
    tv_sat: 05,
    kabel: 06,
    dvr_bdr: 15,
    video_1: 10,
    video_2: 14,
    hdmi_1: 19,
    hdmi_2: 20,
    hdmi_3: 21,
    hdmi_4: 22,
    hdmi_5: 23,
    media: 26,
    ipod_usb: 17,
    xm_radio: 18,
    cd: 01,
    cdr_tape: 03,
    tuner: 02,
    phono: 00,
    multi_ch: 12,
    adapter_port: 33,
    sirius: 27,
    "MediaServer/Airplay": 44,
    //hdmi_cyclic: "31",
};


// SET CODE IN DECIMAL -> [acknowledged display listening modes by receiver]
var ListeningModes = {
    "OPTIMUM SURROUND" : [152, [0x881]],
    "Auto Level Control (Straight Decode)" : [151, [0x501,0x505]],
    "PURE DIRECT" : [8, [0x701,0x705]],
    "Front Stage Surround Advance Wide" : [4, [0x210]],
    "EXTENDED STEREO" : [112, [0x20d]],
    "TV Surround" : [116, [0x207]],
    //"STEREO" : [9,[0x401]],

    "Unknown" : [999, [0xFFF]],
}

var ListeningModeSR2ModeName;
VSX.prototype.getDisplayModes = function() {
    if (ListeningModeSR2ModeName == null ) {
    ListeningModeSR2ModeName = {};
    for (var mode_str in ListeningModes) {
        var mode_int = ListeningModes[mode_str][0];
        if (mode_int != 999) ListeningModeSR2ModeName[mode_int] = mode_str;
            debug_log("added " + mode_int + " -> " + mode_str);
        }
    }
    return ListeningModeSR2ModeName;
}

var InputModeFN2ModeName;
VSX.prototype.getInputModes = () => {
    if (InputModeFN2ModeName == null ) {
        InputModeFN2ModeName = {};
        for (var inputName in Inputs) {
            var mode_int = Inputs[inputName];
            InputModeFN2ModeName[mode_int]=inputName;
        }
    }
    return InputModeFN2ModeName;
}

exports.VSX = VSX;
exports.Inputs = Inputs;
