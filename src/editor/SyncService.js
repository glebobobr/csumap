const CHANNEL = 'csumap:sync'

export const SyncService = {
    _channel: null,

    _getChannel() {
        if (!this._channel && typeof BroadcastChannel !== 'undefined') {
            this._channel = new BroadcastChannel(CHANNEL)
        }
        return this._channel
    },

    broadcast(event, data = {}) {
        const ch = this._getChannel()
        if (ch) ch.postMessage({ event, data, ts: Date.now() })
    },

    onEvent(event, handler) {
        const ch = this._getChannel()
        if (ch) ch.addEventListener('message', (msg) => {
            if (msg.data?.event === event) handler(msg.data)
        })
    },

    onAny(handler) {
        const ch = this._getChannel()
        if (ch) ch.addEventListener('message', (msg) => handler(msg.data))
    },
}
