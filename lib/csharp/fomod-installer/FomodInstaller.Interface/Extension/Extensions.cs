using System;
using System.Collections.Generic;
using System.Text;

namespace FomodInstaller.Extensions
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
			StringBuilder Sb = new StringBuilder();
			foreach (string S in source)
			{
				Sb.Append(S + separator ?? "");
			}
			return Sb.ToString();
		}

        public static bool Contains(this string source, string toCheck, StringComparison comp)
        {
            return source != null && toCheck != null && source.IndexOf(toCheck, comp) >= 0;
        }
    }

	#endregion
}
