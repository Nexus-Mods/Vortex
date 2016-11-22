using System.Collections.Generic;
using System.Text;

namespace Components.Extensions
{
	#region Extensions
	public static class StringExtensions
	{
		/// <summary>
		/// Quickly turns a list of strings into a string separated by a defined character.
		/// </summary>
		/// <param name="separator">The separator char.</param>
		public static string Concat(this IEnumerable<string> source, char separator)
		{
			StringBuilder sb = new StringBuilder();
			foreach (string s in source)
			{
				sb.Append(s + separator ?? "");
			}
			return sb.ToString();
		}
	}

	#endregion
}
