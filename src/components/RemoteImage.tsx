import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { COVER_PLACEHOLDER } from '../utils/coverFallback';
import { coverSrc, deezerCoverAtSize, DEEZER_COVER_SIZES, imagesViaProxy, isProxiableImageUrl, proxiedImageUrl, recordRescuedImage, subscribeImagesViaProxy } from '../utils/imageProxy';

/**
 * An `<img>` of a catalog cover. It loads from the CDN; when that fails it tries once through this site's proxy (for a
 * network that blocks the CDN's domain), and the device switches to the proxy for good after a couple of such rescues.
 */
export const RemoteImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(function RemoteImage(
  { src, onError, onLoad, ...rest },
  ref
) {
  const viaProxyDevice = useSyncExternalStore(subscribeImagesViaProxy, imagesViaProxy);
  const [retriedViaProxy, setRetriedViaProxy] = useState(false);
  // The cover failed for good (the CDN and the proxy both): the neutral picture takes its place (INV-MEDIA-04)
  const [failedForGood, setFailedForGood] = useState(false);
  // A new address starts over: the proxy is for the one that failed
  useEffect(() => {
    setRetriedViaProxy(false);
    setFailedForGood(false);
  }, [src]);
  const showPlaceholder = !src || failedForGood;
  const proxied = (viaProxyDevice || retriedViaProxy) && isProxiableImageUrl(src);
  const addressFor = (value: string | undefined) => (proxied && value ? proxiedImageUrl(value) : coverSrc(value));
  const sized = rest.sizes ? DEEZER_COVER_SIZES.map((width) => ({ width, url: deezerCoverAtSize(src, width) })) : [];
  const srcSet = !showPlaceholder && sized.length > 0 && sized.every((copy) => copy.url) ? sized.map((copy) => `${addressFor(copy.url)} ${copy.width}w`).join(', ') : undefined;

  return (
    <img
      ref={ref}
      {...rest}
      referrerPolicy="no-referrer"
      src={showPlaceholder ? COVER_PLACEHOLDER : addressFor(src)}
      srcSet={srcSet}
      onError={(event) => {
        if (showPlaceholder) {
          // Even the neutral picture did not load: the caller decides what to show
          onError?.(event);
          return;
        }
        if (!proxied && isProxiableImageUrl(src)) {
          setRetriedViaProxy(true);
          return;
        }
        setFailedForGood(true);
      }}
      onLoad={(event) => {
        if (retriedViaProxy && !viaProxyDevice && src) recordRescuedImage(src);
        onLoad?.(event);
      }}
    />
  );
});
