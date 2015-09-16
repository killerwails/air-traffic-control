var CONFIG                    = require("./config"),
    cluster                   = require('cluster'),
    AWS                       = require("aws-sdk"),
    ENVIROMENT_AWS_REGION_MAP = require("./enviromentAwsRegionMap.json"),
    fs                        = require('fs'),
    Slack                     = require("node-slack"),
    slack                     = new Slack("https://hooks.slack.com/services/" + CONFIG.SLACK_TOKEN),
    sys                       = require('sys'),
    exec                      = require('child_process').exec

if (cluster.isMaster) {
  var cpuCount        = require('os').cpus().length,
      numberOfThreads = cpuCount * CONFIG.CPU_MULTIPLIER

  for (var i = 0; i < numberOfThreads; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker) {
    console.log('Worker ' + worker.id + ' died :(')
    cluster.fork()
  })

// Code to run if we're in a worker process
} else {
  var express   = require('express'),
      webserver = express()

  webserver.use (function (req, res) {
    var buffered_out = "<style>pre { background: black;color: white;padding: 20px; } tr:hover { color: white; background: black; } tr:hover a { color: white; } td {padding: 0 20}</style>",
        url_folders  = req.originalUrl.split ('/'),
        enviroment   = url_folders[1],
        action       = url_folders[2],
        playbook     = url_folders[3],
        role         = url_folders[4]

    if (enviroment == "" && enviroment != "favicon.ico") {
      buffered_out += showEnviromentSelection ()
    } else if (action == "build") {
//      buffered_out += build (playbook, enviroment)
    } else if (action == "reforge") {
//      buffered_out += reforge (playbook, enviroment)
    } else if (action == "hotswap") {
//      buffered_out += hotswap (buffered_out, playbook, enviroment, role, function (buffered_out) {
//        res.send (buffered_out)
//      })
    } else {
      buffered_out += showIndex (enviroment)
    }

    if (action != "hotswap")
      res.send(buffered_out)
  })

  webserver.listen(CONFIG.PORT, 'localhost')
  console.log('Air Traffic Control is running')
}

// taken from http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript on 20150812 @ 05:00 EST
function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function getFiles (dir, files_){
    files_ = files_ || []

    try {
      var files = fs.readdirSync(dir)

      for (var i in files) {
          var name = dir + '/' + files[i]

          files_.push(name)
      }

      return files_
    } catch (e) {
      return -1
    }
}

function sendSlack (message) {
  slack.send({
    text: message,
    channel: "#skynet",
    username: "ATC"
  }, function (error) {
    if (error != null && error.message != null) {
      console.log ("Slack: " + error.message)
    }
  })
}

/*function build (playbook, enviroment) {
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
                     "ansible-playbook infrastructure.yml -i hosts/" + enviroment,
      buffered_out = ""

  buffered_out += "<h1>Building " + playbook + " in " + enviroment + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

  sendSlack (playbook + " infra completed in " + enviroment)

  return buffered_out
}*/

/*function reforge (playbook, enviroment) {
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + " && " +
                     "s3cmd sync playbook-" + playbook + "/ s3://telusdigital-forge/" + playbook + "/",
      enviroments  = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + enviroment + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g),
      buffered_out = ""

  buffered_out += "<h1>Reforge " + playbook + " in " + enviroment + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

  for (var i in enviroments) {
    if (enviroments[i] != "") {
      buffered_out += "<h2>" + enviroments[i] + "</h2>"
      buffered_out += "<pre>" + sh.exec ("echo 'sudo reforge' | ssh -o StrictHostKeyChecking=no " + CONFIG.USERID + "@" + enviroments[i]).stdout + "</pre>"
    }
  }

  return buffered_out
}*/

/*function hotswap (buffered_out, playbook, enviroment, role, callback) {
  var all_roles    = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + enviroment + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g),
      current_role = "",
      params       = {
        DryRun: false,
        Filters: [{
            Name: 'instance.group-name',
            Values: [playbook + "-" + role]
          }]
      }

  for (var r in all_roles) {
    if (all_roles[r].indexOf (role) >= 0) {
      current_role = all_roles[r]
    }
  }

  AWS.config.region = ENVIROMENT_AWS_REGION_MAP[enviroment]

  new AWS.EC2().describeInstances(params, function(error, data) {
    if (error) {
      console.log(error)
    } else {
      breakAwsTag (buffered_out, data, playbook, enviroment, current_role, function (buffered_out) {
        rebuildWithoutDNS (buffered_out, playbook, enviroment, function (buffered_out) {
          checkServerIsRunningCorrectly (buffered_out, playbook, enviroment, current_role, 1, function (buffered_out) {
            callback (buffered_out)
          })
        })
      })
    }
  })
}*/

function breakAwsTag (buffered_out, data, playbook, enviroment, role, callback) {
  var instance   = data.Reservations[0].Instances[0],
      instanceId = instance.InstanceId,
      tags       = instance.Tags

  for (t in tags) {
    var key   = tags[t].Key,
        value = tags[t].Value

    if (key == "Role") {
      value += "-broken"

      params = {
        Resources: [instanceId],
        Tags: [{
          Key: key,
          Value: value
        }]
      }
      new AWS.EC2().createTags(params, function(err) {
        console.log("Tagging instance", err ? "failure" : "success")

        if (err) {
          var error_message = "Error: " + err

          buffered_out += error_message
          console.log (error_message)
        }

        callback(buffered_out)
      })
    }
  }
}

/*function rebuildWithoutDNS (buffered_out, playbook, enviroment, callback) {
  var cmd  = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
             "ansible-playbook infrastructure.yml -i hosts/" + enviroment + " --skip-tags dns"

  console.log ("Rebuild without DNS")

  buffered_out += "<h1>Hotswapping " + playbook + " in " + enviroment + "</h1><h2>" + cmd + "</h2>"
                + "<pre>" + sh.exec (cmd).stdout + "</pre>"

    //  sendSlack (playbook + " infra completed in " + enviroment)

  callback (buffered_out)
}*/

function checkServerIsRunningCorrectly (buffered_out, playbook, enviroment, role, attempts, callback) {
  console.log ("Asking IG if server is ok ... " + attempts)

  // get new server address
  new AWS.EC2().describeInstances(function(error, data) {
    if (error) {
      console.log(error)
    } else {
      console.log (data.Reservations.Instances)
    }
  })

  if (attempts == 0) {
    callback (buffered_out)
  } else {
    setTimeout( function () {
      checkServerIsRunningCorrectly (buffered_out, playbook, enviroment, role, --attempts, callback)
    }, 3000)
  }
}

function showEnviromentSelection () {
  var buffered_out = "<h1>Select enviroment</h1>"
                   + "  <ul>"
                   + "    <li><a href='next/'>next</a></li>"
                   + "    <li><a href='development/'>development</a></li>"
                   + "    <li><a href='staging/'>staging</a></li>"
                   + "    <li><a href='production/'>production</a></li>"
                   + "  </ul>"

  return buffered_out
}

function showIndex (enviroment) {
  var playbook_files = getFiles(CONFIG.REPOSITORY_HOME),
      buffered_out   = "<h1><a href='../'>&lt;</a>" + enviroment + "</h1>"
                     + "<table>"
                     + "  <tr>"
                     + "    <th>Playbook</th>"
                     + "    <th></th>"
                     + "  </tr>"

  for (var i in playbook_files) {
    var playbook_file = playbook_files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

    if (playbook_file.indexOf ("playbook-") == 0) {
      var this_playbook = playbook_file.replace ("playbook-", ""),
//        roles      = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + this_playbook + "/hosts/" + enviroment + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g)
          roles         = exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + this_playbook + "/hosts/" + enviroment + " | grep teluswebteam.com", function (error, stdout, stderr) {
            console.log (stdout)
          })

      buffered_out += "<tr>"
                    + "  <td>" + this_playbook + "</td>"
                    + "  <td>"
                    + "    <a href='/" + enviroment + "/build/" + this_playbook + "'>build infra</a> | "
//                    + "    <a href='/" + enviroment + "/reforge/" + this_playbook + "'>reforge</a> | "
//                    + "    hotswap: "

      /*for (var r in roles) {
        var role = roles[r].split(".")[0]

        if (role.indexOf("cat:") != 0)
          buffered_out += "      <a href='/" + enviroment + "/hotswap/" + this_playbook + "/" + role + "'>" + role + "</a>"
      }*/

      buffered_out += "  </td>"
                    + "</tr>"
    }
  }

  buffered_out += "</table>"

  return buffered_out
}
