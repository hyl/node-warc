const WARCWriterBase = require('./warcWriterBase')
const { CRLF } = require('./warcFields')

/** @ignore */
const noGZ = /Content-Encoding.*(?:gzip|br|deflate)\r\n/gi
/** @ignore */
const replaceContentLen = /Content-Length:.*\r\n/gi

/**
 * @desc WARC Generator for use with chrome-remote-interface
 * @see https://github.com/cyrus-and/chrome-remote-interface
 * @link WARCWriterBase
 */
class RemoteChromeWARCGenerator extends WARCWriterBase {
  /**
   * @desc Generate a WARC record
   * @param {RequestInfo}  nreq
   * @param {Object} network
   * @return {Promise<void>}
   */
  async generateWarcEntry (nreq, network) {
    if (nreq.postData) {
      await this.writeRequestRecord(
        nreq.url,
        nreq.serializeRequestHeaders(),
        nreq.postData
      )
    } else if (nreq.hasPostData) {
      let postData
      try {
        let post = await network.getRequestPostData({ requestId: nreq.requestId })
        postData = Buffer.from(post.postData, 'base64')
      } catch (e) {}
      await this.writeRequestRecord(nreq.url, nreq.serializeRequestHeaders(), postData)
    } else {
      await this.writeRequestRecord(nreq.url, nreq.serializeRequestHeaders())
    }
    if (nreq.canSerializeResponse()) {
      let resData
      let responseHeaders = nreq.serializeResponseHeaders()
      if (nreq.getBody) {
        let wasError = false
        try {
          let rbody = await network.getResponseBody({ requestId: nreq.requestId })
          if (rbody.base64Encoded) {
            resData = Buffer.from(rbody.body, 'base64')
          } else {
            resData = Buffer.from(rbody.body, 'utf8')
          }
        } catch (err) {
          wasError = true
        }
        if (!wasError) {
          responseHeaders = responseHeaders.replace(noGZ, '')
          responseHeaders = responseHeaders.replace(
            replaceContentLen,
            `Content-Length: ${Buffer.byteLength(resData, 'utf8')}${CRLF}`
          )
        }
      }
      await this.writeResponseRecord(nreq.url, responseHeaders, resData)
    }
  }
}

module.exports = RemoteChromeWARCGenerator
