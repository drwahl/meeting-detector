// Runs in the page's MAIN world so it can intercept getUserMedia.
// Communicates back via CustomEvents (chrome.runtime not available here).

(function () {
  console.debug('[WMD] content_main injected', location.href);

  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    console.debug('[WMD] getUserMedia called', JSON.stringify(constraints));
    const stream = await original(constraints);

    if (constraints && constraints.audio) {
      document.dispatchEvent(new CustomEvent('__wmd_mic_started'));

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        let notified = false;
        const notifyStop = () => {
          if (!notified) {
            notified = true;
            document.dispatchEvent(new CustomEvent('__wmd_mic_stopped'));
          }
        };
        audioTracks.forEach(track => track.addEventListener('ended', notifyStop));
        stream.addEventListener('inactive', notifyStop);
      }
    }

    return stream;
  };
})();
