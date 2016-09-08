using Util.Collections;

namespace Mods
{
	public interface IModRegistry
	{
		IMod GetMod(string strModPath);
		ReadOnlyObservableList<IMod> RegisteredMods { get; }
	}
}
