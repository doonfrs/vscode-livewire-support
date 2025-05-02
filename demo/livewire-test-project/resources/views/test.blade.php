<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>Laravel</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body>
    <div>
        <h1>Hello World</h1>
    </div>
    <livewire:example-component
        :address="'my address'"
        :show-address="false"
        address="my address" />

    {{-- Alternative Livewire usage --}}
    @livewire('example-component',
    [
    'address'=>'my address',
    'show-address'=>false,
    "address"=>"my address",
    
    ]
    );
</body>

</html>