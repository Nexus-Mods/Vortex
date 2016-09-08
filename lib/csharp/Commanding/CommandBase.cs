using System.ComponentModel;
using System.Drawing;

namespace Commands
{
	/// <summary>
	/// The base class for commands.
	/// </summary>
	public abstract class CommandBase : ICommand
	{
		/// <summary>
		/// Raised when a property changes value.
		/// </summary>
		public event PropertyChangedEventHandler PropertyChanged = delegate { };
		
		private bool m_booCanExecute = true;

		#region Properties

		/// <summary>
		/// Gets the id of the command.
		/// </summary>
		/// <value>The id of the command.</value>
		public string Id { get; private set; }

		/// <summary>
		/// Gets the name of the command.
		/// </summary>
		/// <value>The name of the command.</value>
		public string Name { get; private set; }

		/// <summary>
		/// Gets the description of the command.
		/// </summary>
		/// <value>The description of the command.</value>
		public string Description { get; private set; }

		/// <summary>
		/// Gets the image of the command.
		/// </summary>
		/// <value>The image of the command.</value>
		public Image Image { get; private set; }

		/// <summary>
		/// Gets or sets whether the command can be executed.
		/// </summary>
		/// <value>Whether the command can be executed.</value>
		public bool CanExecute
		{
			get
			{
				return m_booCanExecute;
			}
			set
			{
				if (m_booCanExecute != value)
				{
					m_booCanExecute = value;
					OnPropertyChanged(new PropertyChangedEventArgs("CanExecute"));
				}
			}
		}

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		public CommandBase(string p_strName, string p_strDescription)
			: this(null, p_strName, p_strDescription, null, true)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CommandBase(string p_strName, string p_strDescription, bool p_booCanExecute)
			: this(null, p_strName, p_strDescription, null, p_booCanExecute)
		{
		}

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_strId">The id of the command</param>
		/// <param name="p_strName">The name of the command.</param>
		/// <param name="p_strDescription">The description of the command.</param>
		/// <param name="p_imgImage">The image of the command.</param>
		/// <param name="p_booCanExecute">Whether or not the command can be executed.</param>
		public CommandBase(string p_strId, string p_strName, string p_strDescription, Image p_imgImage, bool p_booCanExecute)
		{
			Id = p_strId;
			Name = p_strName;
			Description = p_strDescription;
			Image = p_imgImage;
			CanExecute = p_booCanExecute;
		}

		#endregion

		/// <summary>
		/// Raises the <see cref="PropertyChanged"/> event.
		/// </summary>
		/// <param name="e">A <see cref="PropertyChangedEventArgs"/> describing the event properties.</param>
		protected void OnPropertyChanged(PropertyChangedEventArgs e)
		{
			PropertyChanged(this, e);
		}
	}
}
