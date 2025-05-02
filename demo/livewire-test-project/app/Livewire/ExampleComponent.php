<?php

namespace App\Livewire;

use Livewire\Component;

class ExampleComponent extends Component
{
    public $name = 'John Doe';

    public $age = 25;

    public $showAddress = false;

    public $address = '123 Main St, Anytown, USA';

    public function render()
    {
        return view('livewire.example-component');
    }
}
