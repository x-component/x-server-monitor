"use strict";
/**
 * Defines and starts the HTTP server for the server monitoring. Extracts process information from the node.js runtime
 * and sends it as HTTP response.
 */
var express = require('express'),
	log     = require('x-log'),
	x       = require('x-common').extend,
	os      = require('os');

module.exports = function (processes) {
	
	var monitor = express();
	
	monitor.configure(function () { // Configuration
		monitor.use(monitor.router);
		monitor.use(/production/.test(process.env.NODE_ENV) ?
			express.errorHandler() :
			express.errorHandler(
				{dumpExceptions:true, showStack:true}
			));
	});
	
	x(monitor, {
		processes:processes || [process],
		
		start:function (options/*port,pidFile*/) {
			options = options || {};
			var monitor = this;
			
			var port = options.port || 38081;
			
			this.get('/os', function (req, res) {
				res.json(monitor.os());
			});
			this.get('/procs', function (req, res) {
				res.json(monitor.procs());
			});
			// create a heap dump
			this.get('/heapdump', function (req, res) {
				try {
					var path = require('path');
					var hd = require(path.join(__dirname, '/node_modules/heapdump/build/Release/heapdump'));
					hd.writeSnapshot();
					res.send(200);
				} catch (ex) {
					res.send(500, ''+ex);
				}
			});
			// remove all heap dumps and corresponding logs
			this.get('/heapdump/remove', function (req, res) {
				try {
					var fs = require('fs'),
						path = require('path');
					fs.readdir(process.cwd(), function(err, files) {
						if (err) {
							res.send(500, err);
							return;
						}
						for (var i = 0; i < files.length; i++) {
							if (files[i].match(/^heapdump-[0-9]+\.[0-9]+\.(?:heapsnapshot|log)$/g)) {
								fs.unlink(path.join(process.cwd(), '/', files[i]));
							}
						}
						res.send(200);
					});
				} catch (ex) {
					res.send(500, ex);
				}
			});
			
			this.listen(port);
			
			if (log.info) log.info('monitor listening on port ' + port + ' in ' + this.settings.env + ' mode');
			
			return this;
		},
		
		os:x(function F() { // return os info
			var r = {};
			F.properties.forEach(function (p) {
				if (os[p] && typeof os[p] === 'function') r[p] = os[p]();
			});
			return r;
		},{properties:'hostname|type|platform|arch|release|uptime|loadavg|totalmem|freemem|cpus|networkInterfaces'.split('|')}),
		
		procs:x(function F() { // return process info for proc
			var procs = [];
			for (var i = 0, l = this.processes.length; i < l; i++) {
				var r = {}, proc = this.processes[i];
				F.properties.forEach(function (p) {
					var rp = p;
					if (p.indexOf('get') === 0)rp = p.substring(3);
					if (proc[p]){
						if (typeof proc[p] === 'function') r[rp] = proc[p]();
						else r[rp] = proc[p];
					}
				});
				procs.push(r);
			}
			return procs;
		},{properties:'env|getuid|getgid|versions|pid|title|arch|platform|umask|cwd|memoryUsage|uptime'.split('|')}),
		
		add:function (proc) {
			this.processes.push(proc);
		}
	});
	return monitor;
};
