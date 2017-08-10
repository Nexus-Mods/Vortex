using System.ComponentModel;

namespace FomodInstaller.Scripting
{
	/// <summary>
	/// Describes the properties and methods of a script.
	/// </summary>
	public interface IScript : INotifyPropertyChanged
	{
		/// <summary>
		/// Gets the type of the script.
		/// </summary>
		/// <value>The type of the script.</value>
		IScriptType Type { get; }
	}
}
