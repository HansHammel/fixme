#!/usr/bin/env node
'use strict';

(function () {

    var byline = require('byline'),
        chalk = require('chalk'),
        eventStream = require('event-stream'),
        fs = require('fs'),
        os = require('os'),
        isBinaryFile = require('isbinaryfile'),
        minimatch = require('minimatch'),
        readdirp = require('readdirp'),
//TODO: get rid of this dirty hack (removing the color codes aterwards)
        stripAnsi = require('strip-ansi');

// TODO(johnp): Allow custom messageChecks to be added via options.
    var parseUserOptionsAndScan = function(options, callback) {

        var ignoredDirectories = ['vendors/**', 'vendor/**', 'bower_components/**', 'jspm_packages/**', 'node_modules/**', '.git/**', '.hg/**'],
            filesToScan = ['**/*.js', 'Makefile', '**/*.sh'],
            scanPath = process.cwd(),
            fileEncoding = 'utf8',
            lineLengthLimit = 40000,
            messageChecks = {
                note: {
                    regex: /[\/\/][\/\*]\s*NOTE\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ✐ NOTE',
                    colorer: chalk.green
                },
                //note: replaced icon - seems to be missing on windows latin/ german language settings in my editor (ultraedit studio)
                //todo: find a better one!
                optimize: {
                    regex: /[\/\/][\/\*]\s*OPTIMI[ZS]E\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ➴ OPTIMIZE',
                    colorer: chalk.blue
                },
                todo: {
                    regex: /[\/\/][\/\*]\s*TODO\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ✓ TODO',
                    colorer: chalk.magenta
                },
                hack: {
                    regex: /[\/\/][\/\*]\s*HACK\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ✄ HACK',
                    colorer: chalk.yellow
                },
                xxx: {
                    regex: /[\/\/][\/\*]\s*XXX\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ✗ XXX',
                    colorer: chalk.black.bgYellow
                },
                fixme: {
                    regex: /[\/\/][\/\*]\s*FIXME\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ☠ FIXME',
                    colorer: chalk.red
                },
                bug: {
                    regex: /[\/\/][\/\*]\s*BUG\s*(?:\(([^:]*)\))*\s*:?\s*(.*)/i,
                    label: ' ☢ BUG',
                    colorer: chalk.white.bgRed
                }
            };

        /**
         * Determines whether or not to let the file through. by ensuring that the
         * file name does not match one of the excluded directories, and ensuring it
         * matches one of the file filters.
         *
         * It will also ensure that even if a binary file matches the filter patterns,
         * it will not let it through as searching binary file contents for string
         * matches will never make sense.
         *
         * @param   {String} fileInformation
         *
         * @return  {Boolean}
         */
// TODO: This could be simpler using minimatch negation patterns in one set, instead disparate ones for files and directories.
        var fileFilterer = function (fileInformation) {
            var shouldIgnoreDirectory = false,
                shouldIgnoreFile = true,
                letTheFileThrough;

            ignoredDirectories.forEach(function (directoryPattern) {
                if (shouldIgnoreDirectory) return;
                shouldIgnoreDirectory = minimatch(fileInformation.path, directoryPattern, { dot: true });
            });

            if (!shouldIgnoreDirectory) {
                filesToScan.forEach(function (filePattern) {
                    if (!shouldIgnoreFile) return;

                    shouldIgnoreFile = !(minimatch(fileInformation.basename, filePattern));
                });
            }

            letTheFileThrough = !(shouldIgnoreDirectory || (!shouldIgnoreDirectory && shouldIgnoreFile));

            // Never let binary files through, searching them for comments will make no sense...
            if (letTheFileThrough && isBinaryFile.isBinaryFileSync(fileInformation.fullPath)) {
                letTheFileThrough = false;
            }

            return letTheFileThrough;
        };

        /**
         * Takes a line of a file and the line number, and returns an array of all of
         * the messages found in that line. Can return multiple messages per line, for
         * example, if a message was annotated with more than one type. EG: FIXME TODO
         *
         * Each message in the array will have a label, a line_number, a colorer, and a
         * message. Will also include an author property if one is found on the
         * message.
         *
         * @param   {String} lineString The
         * @param   {Number} lineNumber
         *
         * @return  {Array}
         */
        var retrieveMessagesFromLine = function (lineString, lineNumber) {
            var messageFormat = {
                    author: null,
                    message: null,
                    label: null,
                    colorer: null,
                    line_number: lineNumber
                },
                messages = [];

            Object.keys(messageChecks).forEach(function (checkName) {
                var matchResults = lineString.match(messageChecks[checkName].regex),
                    checker = messageChecks[checkName],
                    thisMessage;

                if (matchResults && matchResults.length) {
                    thisMessage = JSON.parse(JSON.stringify(messageFormat)); // Clone the above structure.

                    thisMessage.label = checker.label;
                    thisMessage.colorer = checker.colorer;

                    if (matchResults[1] && matchResults[1].length) {
                        thisMessage.author = matchResults[1].trim();
                    }

                    if (matchResults[2] && matchResults[2].length) {
                        thisMessage.message = matchResults[2].trim();
                    }
                }

                if (thisMessage) messages.push(thisMessage);
            });

            return messages;
        };

        /**
         * Takes a line number and returns a padded string matching the total number of
         * characters in totalLinesNumber. EG: A lineNumber of 12 and a
         * totalLinesNumber of 1323 will return the string '  12'.
         *
         * @param   {Number} lineNumber
         * @param   {Number} totalLinesNumber
         *
         * @return  {String}
         */
        var getPaddedLineNumber = function(lineNumber, totalLinesNumber) {
            var paddedLineNumberString = '' + lineNumber;

            while (paddedLineNumberString.length < ('' + totalLinesNumber).length) {
                paddedLineNumberString = ' ' + paddedLineNumberString;
            }

            return paddedLineNumberString;
        };

        /**
         * Takes an individual message object, as output from retrieveMessagesFromLine
         * and formats it for output.
         *
         * @param     {Object}    individualMessage
         * @property  {String}    individualMessage.author
         * @property  {String}    individualMessage.message
         * @property  {String}    individualMessage.label
         * @property  {Function}  individualMessage.colorer
         * @property  {Number}    individualMessage.line_number
         * @param     {Number}    totalNumberOfLines
         *
         * @return    {String}    The formatted message string.
         */
        var formatMessageOutput = function(individualMessage, totalNumberOfLines) {
            var paddedLineNumber = getPaddedLineNumber(individualMessage.line_number, totalNumberOfLines),
                finalLabelString,
                finalNoteString;

            finalNoteString = (options&&options.md ? "* " : '  ') + chalk.gray('[' + paddedLineNumber + '] ');

            finalLabelString = individualMessage.label;

            if (individualMessage.author) {
                finalLabelString += (' from ' + individualMessage.author + ': ');
            } else {
                finalLabelString += ': ';
            }

            finalLabelString = chalk.bold(individualMessage.colorer(finalLabelString));

            finalNoteString += finalLabelString;

            if (individualMessage.message && individualMessage.message.length) {
                finalNoteString += individualMessage.colorer(individualMessage.message);
            } else {
                finalNoteString += chalk.grey('[[no message to display]]');
            }

            return finalNoteString + (options&&options.md ? "  " : '') ;
        };

        /**
         * Formatter function for the file name. Takes a file path, and the total
         * number of messages in the file, and formats this information for display as
         * the heading for the file messages.
         *
         * @param   {String} filePath
         * @param   {Number} numberOfMessages
         *
         * @return  {String}
         */
        var formatFilePathOutput = function(filePath, numberOfMessages) {
            var filePathOutput = chalk.bold.white(os.EOL + (options&&options.md ? '### ' : '* ') + filePath + ' '),
                messagesString = 'messages';

            if (numberOfMessages === 1) {
                messagesString = 'message';
            }

            filePathOutput += chalk.grey('  [' + numberOfMessages + ' ' + messagesString + ']:');

            return filePathOutput;
        };

        /**
         * Takes an object representing the messages and other meta-info for the file
         * and calls off to the formatters for the messages, as well as logs the
         * formatted result.
         *
         * @param     {Object}  messagesInfo
         * @property  {String}  messagesInfo.path The file path
         * @property  {Array}   messagesInfo.messages All of the message objects for the file.
         * @property  {String}  messagesInfo.total_lines Total number of lines in the file.
         */
        var logMessages = function(messagesInfo) {
            if (messagesInfo.messages.length) {
                var result = '';
                var file = formatFilePathOutput(messagesInfo.path, messagesInfo.messages.length);
                //TODO: we could use a stream here and make it the alternative to console
                if (!callback) console.log(file);
                result += file + (options&&options.md ? os.EOL+os.EOL : os.EOL);
                    messagesInfo.messages.forEach(function (message) {
                    var formattedMessage = formatMessageOutput(message, messagesInfo.total_lines);
                    if (!callback) console.log(formattedMessage);
                    result += formattedMessage + os.EOL;
                });
                if (options&&options.md) result += os.EOL;
                return result;
            }
            return null;
        };

        /**
         * Reads through the configured path scans the matching files for messages.
         */
        var scanAndProcessMessages = function(cb) {
            var stream = readdirp(
                scanPath,
                { fileFilter: fileFilterer }
            );

            // TODO: Actually do something meaningful/useful with these handlers.
            stream
                .on('warn', console.warn)
                .on('error', console.error);

            stream
                .pipe(eventStream.map(function (fileInformation, callback) {
                    var input = fs.createReadStream(fileInformation.fullPath, {encoding: fileEncoding}),
                    // lineStream            = byline.createStream(input, { encoding: fileEncoding }),
                        fileMessages = {path: null, total_lines: 0, messages: []},
                        currentFileLineNumber = 1;

                    fileMessages.path = fileInformation.path;

                    input.pipe(eventStream.split())
                        .pipe(eventStream.map(function (fileLineString) {
                                var messages,
                                    lengthError;

                                if (fileLineString.length < lineLengthLimit) {
                                    messages = retrieveMessagesFromLine(fileLineString, currentFileLineNumber);

                                    messages.forEach(function (message) {
                                        fileMessages.messages.push(message);
                                    });
                                } else {
                                    lengthError = 'Fixme is skipping this line because its length is ' +
                                        'greater than the maximum line-length of ' +
                                        lineLengthLimit + '.';

                                    fileMessages.messages.push({
                                        message: lengthError,
                                        line_number: currentFileLineNumber,
                                        label: ' ⚠ SKIPPING CHECK',
                                        colorer: chalk.underline.red
                                    });
                                }

                                currentFileLineNumber += 1;
                            })
                        );

                    input.on('end', function () {
                        fileMessages.total_lines = currentFileLineNumber;

                        var output = logMessages(fileMessages);
                        // if there is an output go on, if the file hase no matches (messages) go on
                        if (output)
                          cb(output);
                    });

                    callback();
                }));
        };

        /**
         * Takes an options object and over-writes the defaults, then calls off to the
         * scanner to scan the files for messages.
         *
         * @param     {Object=}  options                    Optional options
         * @param     {function=} callback                  Optional callback, takes the output as parameter
         * @property  {String}  [options.color=true]        Whether to return ANSI Color Codes in the callback or not. Defaults to false without callback, else to true.
         * @property  {String}  options.path                The base directory to recursively scan for messages. Defaults to process.cwd()
         * @property  {Array}   options.ignored_directories An array of minimatch glob patterns for directories to ignore scanning entirely.
         * @property  {Array}   options.file_patterns       An array of minimatch glob patterns for files to scan for messages.
         * @property  {String}  options.file_encoding       The encoding the files scanned will be opened with, defaults to 'utf8'.
         * @property  {Number}  options.line_length_limit   The number of characters a line can be before it is ignored. Defaults to 1000.
         */

        if (options) {

            if (options.path) {
                scanPath = options.path;
            }

            if (options.ignored_directories &&
                Array.isArray(options.ignored_directories) &&
                options.ignored_directories.length) {
                ignoredDirectories = options.ignored_directories;
            }

            if (options.file_patterns &&
                Array.isArray(options.file_patterns) &&
                options.file_patterns.length) {
                filesToScan = options.file_patterns;
            }

            if (options.file_encoding) {
                fileEncoding = options.file_encoding;
            }

            if (options.line_length_limit) {
                lineLengthLimit = options.line_length_limit;
            }
        }

        scanAndProcessMessages(function (out) {
            if (callback) {
                //used to generate the test files - uncomment and run "mocha fixme.test.js" in test directory. Verify the output!!!
                //fs.writeFileSync('fixme.withoutcolor.' + (os.EOL === "\r\n" ? 'crlf' : 'lf') + '.txt', stripAnsi(out), 'utf8');
                //fs.writeFileSync('fixme.withcolor.' + (os.EOL === "\r\n" ? 'crlf' : 'lf') + '.txt', out, 'utf8');
                if (options.color) callback(out);
                else callback(stripAnsi(out));
            }
        });
    };

    if (!module.parent)
        parseUserOptionsAndScan();
    else
        module.exports = parseUserOptionsAndScan;
})();
