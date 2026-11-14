# Draft: mobile input recovery — unpublished

Target: a narrow addition to existing `/how-it-works/troubleshooting`, not a new keyword page. Final wording must be reconciled with the completed reliability implementation.

## Proposed visible copy

### A photo from my phone will not open

Check the file format before retrying. A phone photo may be HEIC, HEIF or a raw DNG file rather than JPEG. Changing its filename does not change the image format. If the selected tool cannot read it, export a JPEG or PNG copy with your photo editor and try that copy. Keep the original file.

### A small file can still be a large image

File size measures compressed storage. Processing also depends on width and height: an image that is 10,000 by 10,000 pixels contains 100 million pixels even when its file compresses well. Try a smaller exported copy that preserves the aspect ratio. Fine details may be lost when reducing resolution.

If the page reports that the server is busy, wait before submitting again. Repeatedly starting the same conversion can increase load. If a connection fails, check the network before starting a new attempt. Keep the original image so you can retry safely.

## Evidence gates

Verify actual format support per route and normalization message before publication. Do not claim every iPhone failure has the same cause, that every selected phone image is JPEG, or that automatic fallback can run after the operating system terminates a tab. Confirm current server-busy recovery, supported mode limitations, cancellation and download. Add no exact processing limit until it is proven for this route and maintained from its implementation. Link to the existing `/how-it-works/conversion-workflow` guide; do not add several format-specific landing pages.
