// Package httpx holds small HTTP helpers shared by the middleware.
package httpx

import "net/http"

// ResponseWriter records the status code and body size of a response and
// lets middleware run hooks right before the headers are sent.
type ResponseWriter struct {
	http.ResponseWriter
	status      int
	bytes       int64
	wroteHeader bool
	hooks       []func(http.Header)
}

// Wrap returns w as a *ResponseWriter, reusing it if it is one already, so
// several middleware layers share a single wrapper.
func Wrap(w http.ResponseWriter) *ResponseWriter {
	if rw, ok := w.(*ResponseWriter); ok {
		return rw
	}
	return &ResponseWriter{ResponseWriter: w, status: http.StatusOK}
}

// BeforeWriteHeader registers fn to be called just before headers are written.
func (w *ResponseWriter) BeforeWriteHeader(fn func(http.Header)) {
	w.hooks = append(w.hooks, fn)
}

func (w *ResponseWriter) WriteHeader(code int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.status = code
	for _, fn := range w.hooks {
		fn(w.Header())
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *ResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += int64(n)
	return n, err
}

// Flush lets httputil.ReverseProxy stream responses through the wrapper.
func (w *ResponseWriter) Flush() {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	_ = http.NewResponseController(w.ResponseWriter).Flush()
}

// Unwrap is used by http.ResponseController.
func (w *ResponseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *ResponseWriter) Status() int  { return w.status }
func (w *ResponseWriter) Bytes() int64 { return w.bytes }
