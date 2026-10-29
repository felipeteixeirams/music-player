import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { coverSrc, imagesViaProxy, isProxiableImageUrl, proxiedImageUrl, recordRescuedImage, subscribeImagesViaProxy } from '../utils/imageProxy';

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

  return (
    <img
      ref={ref}
      {...rest}
      referrerPolicy="no-referrer"
      src={proxied ? proxiedImageUrl(src as string) : coverSrc(src)}
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
