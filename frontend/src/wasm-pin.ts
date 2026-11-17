// Self-host the ZXing scanner WASM instead of letting zxing-wasm fetch it from the
// jsDelivr CDN at runtime. Import prepareZXingModule from @yudiel/react-qr-scanner
// (it re-exports barcode-detector's BUNDLED copy of the module the Scanner uses);
// importing from "zxing-wasm" directly would target an unused instance.
import readerWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { prepareZXingModule } from "@yudiel/react-qr-scanner";

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string): string =>
      path.endsWith(".wasm") ? readerWasmUrl : prefix + path,
  },
});
