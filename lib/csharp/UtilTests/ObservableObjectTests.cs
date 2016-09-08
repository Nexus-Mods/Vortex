using System.ComponentModel;
using Xunit;

namespace Util.Tests
{
	class ObservableTest : ObservableObject
	{
		private int m_DummyVal;

		public ObservableTest(int init)
		{
			m_DummyVal = init;
		}

		public int Property {
			get
			{
				return m_DummyVal;
			}
			set
			{
				SetPropertyIfChanged(ref m_DummyVal, value, () => Property);
			}
		}

		public int SecondProperty
		{
			get
			{
				return m_DummyVal;
			}
			set
			{
				SetPropertyIfChanged(ref m_DummyVal, value, () => SecondProperty);
			}
		}
	}

	public class ObservableObjectTests
	{
		ObservableTest observable = null;

		public ObservableObjectTests()
		{
			 observable = new ObservableTest(0);
		}

		[Fact]
		public void SetPropertyChangedTriggers()
		{
			bool triggered = false;
			observable.PropertyChanged += (object sender, PropertyChangedEventArgs args) => {
				triggered = true;
			};
			observable.Property = 42;

			Assert.True(triggered);
		}

		[Fact]
		public void SetPropertyChangedTriggersOnlyOnChange()
		{
			bool triggered = false;
			observable.PropertyChanged += (object sender, PropertyChangedEventArgs args) => {
				triggered = true;
			};
			observable.Property = 0;

			Assert.False(triggered);
		}

		[Fact]
		public void SetPropertyChangedTriggersCorrectProperty()
		{
			ObservableTest observable = new ObservableTest(42);
			observable.PropertyChanged += (object sender, PropertyChangedEventArgs args) => {
				Assert.StrictEqual(args.PropertyName, "Property");
			};
			observable.Property = 42;
		}
	}
}