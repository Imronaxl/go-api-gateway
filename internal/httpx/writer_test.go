package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRecordsStatusAndBytes(t *testing.T) {
	rec := httptest.NewRecorder()
	w := Wrap(rec)

	w.WriteHeader(http.StatusTeapot)
	w.WriteHeader(http.StatusInternalServerError) // ignored, like net/http
	_, _ = w.Write([]byte("hello"))

	if w.Status() != http.StatusTeapot || rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d / %d, want 418", w.Status(), rec.Code)
	}
	if w.Bytes() != 5 {
		t.Fatalf("bytes = %d, want 5", w.Bytes())
	}
}

func TestImplicitOKAndHooks(t *testing.T) {
	rec := httptest.NewRecorder()
	w := Wrap(rec)
	w.BeforeWriteHeader(func(h http.Header) { h.Set("X-Hook", "1") })

	if Wrap(w) != w {
		t.Fatal("Wrap allocated a second wrapper")
	}

	_, _ = w.Write([]byte("x"))

	if rec.Code != http.StatusOK || w.Status() != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Header().Get("X-Hook") != "1" {
		t.Fatal("hook did not run before headers were written")
	}
}

func TestFlush(t *testing.T) {
	rec := httptest.NewRecorder()
	w := Wrap(rec)

	if err := http.NewResponseController(w).Flush(); err != nil {
		t.Fatalf("Flush through ResponseController: %v", err)
	}
	if !rec.Flushed {
		t.Fatal("underlying writer was not flushed")
	}
}
