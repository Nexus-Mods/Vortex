// identifies how Vortex was installed. This controls its behavior around auto updating for example.
// 'regular' means our own installer was used meaning Vortex itself provides capabilities for updating,
// uninstalling and so on.
// 'managed' means Vortex was installed through a store which is then responsible for updating or
// uninstalling.
type VortexInstallType = 'regular' | 'managed';

export default VortexInstallType;
