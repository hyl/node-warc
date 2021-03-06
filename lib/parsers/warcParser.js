/** @ignore */
const bsplit = require('./splitter')
/** @ignore */
const untildify = require('untildify')
/** @ignore */
const fs = require('fs-extra')
const EventEmitter = require('eventemitter3')
const WARCRecorderBuilder = require('../warcRecordBuilder/index')
const warcFieldIdentifiers = require('../warcRecordBuilder/fieldIdentifiers')
const RecSepCounter = require('./recSepCounter')

/**
 * @desc Parse a WARC file
 * @extends {EventEmitter}
 * @example
 *  const parser = new WARCParser('<path-to-warcfile>')
 *  parser.on('record', record => { console.log(record) })
 *  parser.on('done', finalRecord => { console.log(finalRecord) })
 *  parser.on('error', error => { console.error(error) })
 *  parser.start()
 * @example
 *  const parser = new WARCParser()
 *  parser.on('T', record => { console.log(record) })
 *  parser.on('done', finalRecord => { console.log(finalRecord) })
 *  parser.on('error', error => { console.error(error) })
 *  parser.parseWARC('<path-to-warcfile>')
 */
class WARCParser extends EventEmitter {
  /**
   * @desc Create a new WARCParser
   * @param {?string} wp path to the warc file tobe parsed
   */
  constructor (wp = null) {
    super()
    /**
     * @type {?string} the path to the WARC file to be parsed
     * @private
     */
    this._wp = wp

    /**
     * @type {ReadStream} the underlying ReadStream
     * @private
     */
    this._readStream = null

    /**
     * @type {boolean} should the parser check the current lines buffer for the warctype
     * @private
     */
    this._checkRecType = false

    /**
     * @type {boolean} have we identified the records correct WARC-Type for the record
     * @private
     */
    this._foundType = false

    /**
     * @type {boolean} is the parser just starting to parse the WARC file
     * @private
     */
    this._starting = true

    /**
     * @type {boolean} is the parser currently parsing the WARC
     * @private
     */
    this._parsing = false

    /**
     * @type {RecSepCounter}
     * @private
     */
    this._crlfCounter = new RecSepCounter()

    /**
     * @type {WARCRecorderBuilder}
     * @private
     */
    this._builder = new WARCRecorderBuilder()
  }

  /**
   * @desc Begin parsing the WARC file. Once the start method has been called the parser will begin emitting
   * @emits {record} emitted when the parser has parsed a full record, the argument supplied to the listener will be the parsed record
   * @emits {done} emitted when the WARC file has been completely parsed, the argument supplied to the listener will be last record
   * @emits {error} emitted if an exception occurs, the argument supplied to the listener will be the error that occurred.
   * @return {boolean} indication if the parser has begun or is currently parsing a WARC file
   * - true: indicates the parser has begun parsing the WARC file true
   * - false: indicated the parser is currently parsing a WARC file
   * @throws {Error} if the path to the WARC file is null or undefined or another error occurred
   */
  start () {
    if (!this._parsing) {
      if (this._wp === null || this._wp === undefined) {
        throw new Error('The path to the WARC file is undefined')
      }
      this._starting = true
      this._parsing = true
      let lastBegin
      let buildKey
      let isEmptyLine
      this._readStream = fs.createReadStream(untildify(this._wp))
      this._readStream
        .pipe(bsplit())
        .on('data', line => {
          if (line.indexOf(warcFieldIdentifiers.begin) === 0) {
            if (!this._starting) {
              this.emit('record', this._builder.buildRecord(buildKey))
            } else {
              this._starting = false
            }
            this._crlfCounter.reset()
            this._checkRecType = true
            lastBegin = line
          } else {
            isEmptyLine = warcFieldIdentifiers.empty.equals(line)
            if (this._checkRecType && !isEmptyLine) {
              this._checkRecType = false
              buildKey = this._builder.determineWarcType(line, lastBegin)
            } else if (isEmptyLine) {
              this._crlfCounter.increment()
            } else {
              this._builder.addLineTo(buildKey, this._crlfCounter.count, line)
            }
          }
        })
        .on('error', error => {
          this.emit('error', error)
        })
        .on('end', () => {
          this._parsing = false
          this._readStream.destroy()
          let record = this._builder.buildRecord(buildKey)
          this.emit('done', record)
        })
    } else {
      return false
    }
  }

  /**
   * @desc Alias for {@link start} except that you can supply the path to the WARC file to be parsed
   * if one was not supplied via the constructor or to parse another WARC file. If the path to WARC file
   * to be parsed was supplied via the constructor and you supply a different path to this method.
   * It will override the one supplied via the constructor
   * @param {?string} wp the path to the WARC file to be parsed
   * @return {boolean} indication if the parser has begun or is currently parsing a WARC file
   * @throws {Error} if the path to the WARC file is null or undefined or another error occurred
   */
  parseWARC (wp) {
    if (!this._parsing) {
      this._wp = wp || this._wp
    }
    return this.start()
  }
}

module.exports = WARCParser
