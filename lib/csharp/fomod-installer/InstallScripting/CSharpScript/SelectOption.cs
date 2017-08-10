
namespace FomodInstaller.Scripting.CSharpScript
{
	/// <summary>
	/// Describes the options to display in a select form.
	/// </summary>
	public struct SelectOption
	{
		/// <summary>
		/// The name of the selection item.
		/// </summary>
		public string Item;

		/// <summary>
		/// The path to the preview image of the item.
		/// </summary>
		public string Preview;

		/// <summary>
		/// The description of the selection item.
		/// </summary>
		public string Desc;

		/// <summary>
		/// A simple constructor that initializes the struct with the given values.
		/// </summary>
		/// <param name="item">The name of the selection item.</param>
		/// <param name="preview">The path to the preview image of the item.</param>
		/// <param name="desc">The description of the selection item.</param>
		public SelectOption(string item, string preview, string desc)
		{
			Item = item;
			Preview = preview;
			Desc = desc;
		}
	}
}
