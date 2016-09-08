using Scripting;
using Util.BackgroundTasks;

namespace Scripting
{
	/// <summary>
	/// Describes the properties and methods of an object that executes
	/// a script.
	/// </summary>
	public interface IScriptExecutor : IBackgroundTaskSet
	{
		/// <summary>
		/// Executes the script.
		/// </summary>
		/// <returns><c>true</c> if the script completed
		/// successfully; <c>false</c> otherwise.</returns>
		bool Execute(IScript p_scpScript);
	}
}
