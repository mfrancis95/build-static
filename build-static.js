var exec = require("child_process").exec;
var walk = require("walk-gen");
var path = require("path");
var fs = require("fs");
var inlinify = require("inlinify");
var minify = require("minify");

function build(depth) {
    return new Promise((resolve, reject) => {
        exec("rm -r dist; cp -r build dist", error => {
            if (error) {
                reject(error);
            }
            else {
                var files = Array.from(walk("dist", depth));
                var cwd = process.cwd();
                var promises = [];
                for (var info of require("./build.json")) {
                    for (var file of files) {
                        if (file.match(info.pattern)) {
                            promises.push(transformer(cwd, file, info));
                        }
                    }
                }
                promises.push(() => new Promise(resolve));
                promises.reduce((current, next) => current.then(next), Promise.resolve());
            }
        });
    });
}

function transform(cwd, file, transforms) {
    return new Promise(resolve => {
        var directory = path.join(cwd, path.dirname(file));
        var data = fs.readFileSync(file).toString();
        process.chdir(directory);
        if (transforms.minify) {
            console.log(`Minifying ${file}`);
            transformMinify(data, file.endsWith(".css")).then(minified => {
                process.chdir(cwd);
                fs.writeFile(file, minified, resolve);
            });
        }
        else if (transforms.inlinify) {
            console.log(`Inlinifying ${file}`);
            transformInlinify(data, transforms.inlinify).then(html => {
                process.chdir(cwd);
                fs.writeFile(file, html, resolve);
            });
        }
        else {
            resolve();
        }
    });
}

function transformer(cwd, file, transforms) {
    return () => transform(cwd, file, transforms);
}

function transformInlinify(data, properties) {
    if (properties.css) {
        return inlinify.css(data).then(html => {
            return properties.js ? inlinify.js(html) : Promise.resolve(html);
        });
    }
    else {
        return inlinify.js(data);
    }
};


function transformMinify(data, css) {
    return css ? minify.css(data) : minify.js(data);
}

build(process.argv[2]).then(() => console.log("Done building."), console.log);
