# Fixme #

Scan for NOTE, OPTIMIZE, OPTIMISE, TODO, HACK, XXX, FIXME, and BUG comments within your source, and print them to stdout so you can deal with them. This is similar to the ```rake notes``` task from Rails.

[![Build Status](https://travis-ci.org/HansHammel/fixme.svg?branch=master)](https://travis-ci.org/HansHammel/fixme)
[![Inline docs](http://inch-ci.org/github/HansHammel/fixme.svg?branch=master)](http://inch-ci.org/github/HansHammel/fixme)
[![star this repo](http://githubbadges.com/star.svg?user=HansHammel&repo=fixme&style=flat&color=fff&background=007ec6)](https://github.com/HansHammel/fixme)
[![fork this repo](http://githubbadges.com/fork.svg?user=HansHammel&repo=fixme&style=flat&color=fff&background=007ec6)](https://github.com/HansHammel/fixme/fork)
[![david dependency](https://img.shields.io/david/HansHammel/fixme.svg)](https://david-dm.org/HansHammel/fixme)
[![david devDependency](https://img.shields.io/david/dev/HansHammel/fixme.svg)](https://david-dm.org/HansHammel/fixme)
[![david optionalDependency](https://img.shields.io/david/optional/HansHammel/fixme.svg)](https://david-dm.org/HansHammel/fixme)
[![david peerDependency](https://img.shields.io/david/peer/HansHammel/fixme.svg)](https://david-dm.org/HansHammel/fixme)
[![Known Vulnerabilities](https://snyk.io/test/github/HansHammel/fixme/badge.svg)](https://snyk.io/test/github/HansHammel/fixme)

It ends up giving you an output like this:

![](http://i.imgur.com/OXsTtCZ.png)

The color formatting is currently done using the excellent terminal coloring library [chalk](https://www.npmjs.org/package/chalk).

*Fixme currently scans your matching files line-by-line looking for annotations in the code. As such; multi-line annotation capturing is currently not supported. All annotations must be on the same line.*

## Useage ##

In order to use Fixme all you need to do is install it:

> npm install -g fixme

### CLI Usage:

For help type

```sh
fixme --help
```

```sh
fixme
```

will search the current directory for all `.js` files in all subdirectories except some preconfigured once _(vendors/**, vendor/**, bower_components/**, jspm_packages/**, node_modules/**)_

Note: Passing custom options from the command line is currently not supported.

### Programmatic Usage

When using it **programtically**

_like so:_

```javascript
var fixme = require('fixme');
```

the follwing options can be configured:

```javascript
// All values below are Fixme default values unless otherwise overridden here.
var options = {
  path:                 process.cwd(),
  ignored_directories:  ['node_modules/**', '.git/**', '.hg/**'],
  file_patterns:        ['**/*.js', 'Makefile', '**/*.sh'],
  file_encoding:        'utf8',
  line_length_limit:    1000,
  color:                true
};
```

when called like so:

```javascript
fixme(options, function(outptu){ 
    console.log(output) 
});
```

you should then see some nice output, when run:

```
• path/to/your/directory/file.js [4 messages]:
  [Line   1]  ✐ NOTE: This is here because sometimes an intermittent issue appears.
  [Line   7]  ↻ OPTIMIZE: This could be reworked to not do a O(N2) lookup.
  [Line   9]  ✓ TODO from John: Add a check here to ensure these are always strings.
  [Line  24]  ✄ HACK: I am doing something here that is horrible, but it works for now...
  [Line  89]  ✗ XXX: Let's do this better next time? It's bad.
  [Line 136]  ☠ FIXME: We sometimes get an undefined index in this array.
  [Line 211]  ☢ BUG: If the user inputs "Easter" we always output "Egg", even if they wanted a "Bunny".
```

Note: `fixme(options, callback)` returns no value. Both, the option parameter and the callback functions are optional. 

### Configure Options (In More Detail) ###

  * **path:** The path to scan through for notes, defaults to process.cwd()
  * **ignored_directories:** Glob patterns for directories to ignore. Passes these straight to [minimatch](https://www.npmjs.org/package/minimatch) so check there for more information on proper syntax.
  * **file_patterns:** Glob patterns for files to scan. Also uses [minimatch](https://www.npmjs.org/package/minimatch).
  * **file_encoding:** The encoding the files scanned will be opened as.
  * **line_length_limit:** The number of max characters a line can be before Fixme gives up and doen not scan it for matches. If a line is too long, the regular expression will take an extremely long time to finish. *You have been warned!*

### Using With [GulpJS](http://gulpjs.com/) ###

Using this as a GulpJS task is pretty simple, here is a very straight-forward "notes" task:

```javascript
gulp.task('notes', fixme);
```

That, of course, assumes all of the defaults in Fixme are ok with you. If not, this is still pretty simple to configure and run as a Gulp task:

```javascript
gulp.task('notes', function () {
  fixme({
    path:                 process.cwd(),
    ignored_directories:  ['node_modules/**', '.git/**', '.hg/**'],
    file_patterns:        ['**/*.js', 'Makefile', '**/*.sh'],
    file_encoding:        'utf8',
    line_length_limit:    1000
  });
});
```

### Writing Comments for Use With Fixme ###

A code annotation needs to follow these rules to be picked up by Fixme:

  * Can be preceeded by 0 to n number of characters, this includes the comment characters // and /*
  * Must have one of the words: NOTE, OPTIMIZE, TODO, HACK, XXX, FIXME, or BUG
  * Can have 0 to n space characters
  * Can have an author in parenthesis after the above word, and before a colon (:)
  * Can have 0 to n space characters
  * Must be followed by a colon (:)
  * Can have 0 to n space characters
  * Should have a message of 0 to n characters for the note

#### Displaying Authors ####

You can have an author of a comment displayed via Fixme:

```javascript
// NOTE(John Postlethwait): This comment will be shown as a note, and have an author!
```

```shell
  [Line 1]  ✐ NOTE from John Postlethwait: This comment will be shown as a note, and have an author!
```

#### More Examples ####

Take a look at the ```test/annotation_test.js``` file, all of those comments in there are supported and expected to parse with Fixme.
