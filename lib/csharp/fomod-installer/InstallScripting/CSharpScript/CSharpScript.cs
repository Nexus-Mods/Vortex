using Utils;

namespace FomodInstaller.Scripting.CSharpScript
{
	/// <summary>
	/// Represents an C# script.
	/// </summary>
	public class CSharpScript : ObservableObject, IScript
	{
		private string m_strCode = null;

		#region IScript Members

		/// <summary>
		/// Gets the type of the script.
		/// </summary>
		/// <value>The type of the script.</value>
		public IScriptType Type { get; private set; }

		#endregion

		#region Properties

		/// <summary>
		/// Gets or sets the C# script code.
		/// </summary>
		/// <value>The C# script code.</value>
		public string Code
		{
			get
			{
				return m_strCode;
			}
			set
			{
				SetPropertyIfChanged(ref m_strCode, value, () => Code);
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_cstScripType">The script's type.</param>
		/// <param name="p_strCode">The C# script code.</param>
		public CSharpScript(CSharpScriptType p_cstScripType, string p_strCode)
		{
			Type = p_cstScripType;
			Code = p_strCode;
		}

		#endregion
	}
}
