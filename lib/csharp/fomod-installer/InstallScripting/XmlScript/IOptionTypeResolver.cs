using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.XmlScript
{
	/// <summary>
	/// The possible option types.
	/// </summary>
	public enum OptionType
	{
		/// <summary>
		/// Indicates the option must be installed.
		/// </summary>
		Required,

		/// <summary>
		/// Indicates the option is optional.
		/// </summary>
		Optional,

		/// <summary>
		/// Indicates the option is recommended for stability.
		/// </summary>
		Recommended,

		/// <summary>
		/// Indicates that using the option could result in instability (i.e., a prerequisite plugin is missing).
		/// </summary>
		NotUsable,

		/// <summary>
		/// Indicates that using the option could result in instability if loaded
		/// with the currently active plugins (i.e., a prerequisite plugin is missing),
		/// but that the prerequisite option is installed, just not activated.
		/// </summary>
		CouldBeUsable
	}

	/// <summary>
	/// Defines the interface for an option type object.
	/// </summary>
	public interface IOptionTypeResolver
	{
        /// <summary>
        /// Determines the option type based on the given install state.
        /// </summary>
        /// <param name="coreDelegates">The Core delegates component.</param>
        /// <returns>The option type.</returns>
        OptionType ResolveOptionType(ConditionStateManager csmState, CoreDelegates coreDelegates);
	}
}
