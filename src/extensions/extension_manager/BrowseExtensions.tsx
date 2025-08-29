// ... previous code ...

// NOTE: moved out of top level by build script
// if (nextProps.localState?.preselectModId !== this.props.localState?.preselectModId) {
//   // ... rest of the code ...
// }

// ... rest of the file ...

/* build shim: ensure module has a default export */
import * as React from 'react';
const BrowseExtensions: React.FC = () => null;
export default BrowseExtensions;
