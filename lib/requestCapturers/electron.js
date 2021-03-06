const RequestHandler = require('./requestHandler')

/**
 * @extends RequestHandler
 * @desc The remote electron request chapturer to use along side {@link ElectronWARCGenerator}
 * See the documentation for {@link attach} and {@link maybeNetworkMessage} for setup information
 * Controlled via {@link startCapturing} and {@link stopCapturing}
 * @see https://electron.atom.io/docs/api/debugger/
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Network
 */
class ElectronRequestCapturer extends RequestHandler {
  /**
   * @param {{reqStarted: function(info: Object), reqFinished: function(info: Object)}} [navMan]
   */
  constructor (navMan) {
    super()
    this.maybeNetworkMessage = this.maybeNetworkMessage.bind(this)
    this.attach = this.attach.bind(this)
    this.requestWillBeSent = this.requestWillBeSent.bind(this)
    this.responseReceived = this.responseReceived.bind(this)
    this.loadingFinished = this.loadingFinished.bind(this)
    this.loadingFailed = this.loadingFailed.bind(this)
    this._navMan = navMan
  }

  /**
   * @desc Attach to the debugger {@link requestWillBeSent} and {@link responseReceived}
   * @param wcDebugger the debugger
   * @see https://electron.atom.io/docs/api/debugger/
   */
  attach (wcDebugger) {
    wcDebugger.on('message', (event, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        this.requestWillBeSent(params)
      } else if (method === 'Network.responseReceived') {
        this.responseReceived(params)
      }
      if (this._navMan) {
        if (method === 'Network.loadingFinished') {
          this.loadingFinished(params)
        } else if (method === 'Network.loadingFailed') {
          this.loadingFailed(params)
        }
      }
    })
  }

  /**
   * @desc Rather than adding an additional listener to the debugger pass the two relevant parameters
   * of the listener to this method. Useful if you are already listening to some other event.
   * {@link attach}, {@link requestWillBeSent} and {@link responseReceived}
   * @param {string} method the event method
   * @param {Object} params the parameters of the event
   * @see https://electron.atom.io/docs/api/debugger/
   */
  maybeNetworkMessage (method, params) {
    if (method === 'Network.requestWillBeSent') {
      this.requestWillBeSent(params)
    } else if (method === 'Network.responseReceived') {
      this.responseReceived(params)
    }
    if (this._navMan) {
      if (method === 'Network.loadingFinished') {
        this.loadingFinished(params)
      } else if (method === 'Network.loadingFailed') {
        this.loadingFailed(params)
      }
    }
  }

  /**
   *
   * @param {{reqStarted: function(info: Object), reqFinished: function(info: Object)}} navMan
   */
  withNavigationManager (navMan) {
    this._navMan = navMan
  }
}

module.exports = ElectronRequestCapturer
