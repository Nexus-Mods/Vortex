using Scripting;
using System.ComponentModel;

namespace Mods
{
	/// <summary>
	/// The interface for mods that contain mod manager scripts.
	/// </summary>
	public interface IScriptedMod : INotifyPropertyChanged
	{
		/// <summary>
		/// Gets whether the mod has a custom install script.
		/// </summary>
		/// <value>Whether the mod has a custom install script.</value>
		bool HasInstallScript { get; }

		/// <summary>
		/// Gets or sets the mod's install script.
		/// </summary>
		/// <value>The mod's install script.</value>
		IScript InstallScript { get; set; }
	}
}
