using GameMode;
using Mods;

namespace Scripting
{
	public interface IScriptExecutorFactory
	{
		IScriptExecutor CreateExecutor(IScript p_scrScript, IMod p_modMod, IGameMode p_gmdGameMode, InstallerGroup p_igpInstallers);
	}
}
