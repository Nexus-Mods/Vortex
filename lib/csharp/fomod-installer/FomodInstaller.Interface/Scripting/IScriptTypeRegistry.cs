using System.Collections.Generic;

namespace FomodInstaller.Scripting
{
	/// <summary>
	/// Describes the properties and methods of a script type registry.
	/// </summary>
	/// <summary>
	/// A script type registry tracks a list of mod script types.
	/// </summary>
	public interface IScriptTypeRegistry
	{
		#region Properties

		/// <summary>
		/// Gets the registered <see cref="IScriptType"/>s.
		/// </summary>
		/// <value>The registered <see cref="IScriptType"/>s.</value>
		ICollection<IScriptType> Types { get; }

		#endregion

		/// <summary>
		/// Registers the given <see cref="IScriptType"/>.
		/// </summary>
		/// <param name="p_stpType">A <see cref="IScriptType"/> to register.</param>
		void RegisterType(IScriptType p_stpType);

		/// <summary>
		/// Gets the specified <see cref="IScriptType"/>.
		/// </summary>
		/// <param name="p_strScriptTypeId">The id of the <see cref="IScriptType"/> to retrieve.</param>
		/// <returns>The <see cref="IScriptType"/> whose id matches the given id. <c>null</c> is returned
		/// if no <see cref="IScriptType"/> with the given id is in the registry.</returns>
		IScriptType GetType(string p_strScriptTypeId);
	}
}
