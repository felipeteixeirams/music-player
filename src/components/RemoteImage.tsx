import React, { useEffect, useState, useSyncExternalStore } from 'react';
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
  // A new address starts over: the proxy is for the one that failed
  useEffect(() => setRetriedViaProxy(false), [src]);
  const proxied = (viaProxyDevice || retriedViaProxy) && isProxiableImageUrl(src);
  const addressFor = (value: string | undefined) => (proxied && value ? proxiedImageUrl(value) : coverSrc(value));
  const sized = rest.sizes ? DEEZER_COVER_SIZES.map((width) => ({ width, url: deezerCoverAtSize(src, width) })) : [];
  const srcSet = sized.length > 0 && sized.every((copy) => copy.url) ? sized.map((copy) => `${addressFor(copy.url)} ${copy.width}w`).join(', ') : undefined;

  return (
    <img
      ref={ref}
      {...rest}
      referrerPolicy="no-referrer"
      src={addressFor(src)}
      srcSet={srcSet}
      onError={(event) => {
        if (!proxied && isProxiableImageUrl(src)) {
          setRetriedViaProxy(true);
          return;
        }
        onError?.(event);
      }}
      onLoad={(event) => {
        if (retriedViaProxy && !viaProxyDevice && src) recordRescuedImage(src);
        onLoad?.(event);
      }}
    />
  );
});
