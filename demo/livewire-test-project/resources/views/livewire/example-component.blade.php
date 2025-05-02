<div>
    <h1>Hello World</h1>
    <h2>Name: {{ $name }}</h2>
    <h2>Age: {{ $age }}</h2>
    <h2>Show Address: {{ $showAddress ? 'Yes' : 'No' }}</h2>

    @if ($showAddress)
        <h2>Address: {{ $address }}</h2>
    @endif
</div>
