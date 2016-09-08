
namespace UI
{
	/// <summary>
	/// The possible results of the overwrite form.
	/// </summary>
	public enum OverwriteResult
	{
		/// <summary>
		/// Do not overwrite the item.
		/// </summary>
		No = 0,

		/// <summary>
		/// Do not overwrite the item, or any subsequent items.
		/// </summary>
		NoToAll,

		/// <summary>
		/// Do not overwrite the item, or any subsequent items in the same group.
		/// </summary>
		NoToGroup,

		/// <summary>
		/// Overwrite the item.
		/// </summary>
		Yes,

		/// <summary>
		/// Overwrite the item, and all subsequent items.
		/// </summary>
		YesToAll,

		/// <summary>
		/// Overwrite the item, and all subsequent items in the same group.
		/// </summary>
		YesToGroup,

		/// <summary>
		/// Do not overwrite the item, or any subsequent items in the same mod.
		/// </summary>
		NoToMod,

		/// <summary>
		/// Overwrite the item, and all subsequent items in the same mod.
		/// </summary>
		YesToMod
	}
}
